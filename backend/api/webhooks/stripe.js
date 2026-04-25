/**
 * ESTIF HOME ULTIMATE - STRIPE WEBHOOK HANDLER
 * Handle Stripe payment events for subscriptions and one-time payments
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const Stripe = require('stripe');
const crypto = require('crypto');

// Initialize Stripe with webhook secret
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Models (assuming these exist)
const User = require('../../models/User');
const Payment = require('../../models/Payment');
const Subscription = require('../../models/Subscription');
const ActivityLog = require('../../models/ActivityLog');

/**
 * Verify Stripe webhook signature
 */
const verifyWebhookSignature = (req) => {
    const sig = req.headers['stripe-signature'];
    
    try {
        const event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            webhookSecret
        );
        return event;
    } catch (err) {
        console.error(`❌ Webhook signature verification failed: ${err.message}`);
        throw new Error(`Webhook Error: ${err.message}`);
    }
};

/**
 * Handle successful payment
 */
const handlePaymentSucceeded = async (event) => {
    const paymentIntent = event.data.object;
    
    const payment = await Payment.create({
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: 'succeeded',
        customerId: paymentIntent.customer,
        paymentMethodId: paymentIntent.payment_method,
        metadata: paymentIntent.metadata,
        receiptUrl: paymentIntent.charges?.data[0]?.receipt_url,
        paidAt: new Date()
    });
    
    // Update user's subscription if applicable
    if (paymentIntent.metadata.subscriptionId) {
        await Subscription.findByIdAndUpdate(
            paymentIntent.metadata.subscriptionId,
            {
                status: 'active',
                lastPaymentId: payment._id,
                nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        );
    }
    
    // Log activity
    await ActivityLog.create({
        userId: paymentIntent.metadata.userId,
        action: 'payment_succeeded',
        details: {
            amount: payment.amount,
            currency: payment.currency,
            paymentIntentId: paymentIntent.id
        }
    });
    
    console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
};

/**
 * Handle payment failure
 */
const handlePaymentFailed = async (event) => {
    const paymentIntent = event.data.object;
    
    const payment = await Payment.create({
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: 'failed',
        customerId: paymentIntent.customer,
        errorMessage: paymentIntent.last_payment_error?.message,
        metadata: paymentIntent.metadata
    });
    
    // Update subscription status
    if (paymentIntent.metadata.subscriptionId) {
        await Subscription.findByIdAndUpdate(
            paymentIntent.metadata.subscriptionId,
            {
                status: 'past_due',
                lastPaymentError: paymentIntent.last_payment_error?.message
            }
        );
    }
    
    // Send notification to user
    // await sendNotification(userId, 'payment_failed', { amount: payment.amount });
    
    console.log(`❌ Payment failed: ${paymentIntent.id}`);
};

/**
 * Handle subscription created
 */
const handleSubscriptionCreated = async (event) => {
    const subscription = event.data.object;
    
    await Subscription.create({
        stripeSubscriptionId: subscription.id,
        userId: subscription.metadata.userId,
        planId: subscription.items.data[0].price.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription.metadata
    });
    
    console.log(`✅ Subscription created: ${subscription.id}`);
};

/**
 * Handle subscription updated
 */
const handleSubscriptionUpdated = async (event) => {
    const subscription = event.data.object;
    
    await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: subscription.id },
        {
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            updatedAt: new Date()
        }
    );
    
    console.log(`🔄 Subscription updated: ${subscription.id}`);
};

/**
 * Handle subscription cancelled
 */
const handleSubscriptionCancelled = async (event) => {
    const subscription = event.data.object;
    
    await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: subscription.id },
        {
            status: 'canceled',
            canceledAt: new Date(),
            updatedAt: new Date()
        }
    );
    
    console.log(`❌ Subscription cancelled: ${subscription.id}`);
};

/**
 * Handle invoice payment succeeded
 */
const handleInvoicePaymentSucceeded = async (event) => {
    const invoice = event.data.object;
    
    await Payment.create({
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: invoice.subscription,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        status: 'succeeded',
        invoiceUrl: invoice.hosted_invoice_url,
        paidAt: new Date()
    });
    
    console.log(`✅ Invoice paid: ${invoice.id}`);
};

/**
 * Handle invoice payment failed
 */
const handleInvoicePaymentFailed = async (event) => {
    const invoice = event.data.object;
    
    await Payment.create({
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: invoice.subscription,
        amount: invoice.amount_due / 100,
        currency: invoice.currency,
        status: 'failed',
        errorMessage: invoice.last_finalization_error?.message,
        invoiceUrl: invoice.hosted_invoice_url
    });
    
    // Update subscription status
    if (invoice.subscription) {
        await Subscription.findOneAndUpdate(
            { stripeSubscriptionId: invoice.subscription },
            { status: 'past_due' }
        );
    }
    
    console.log(`❌ Invoice payment failed: ${invoice.id}`);
};

/**
 * Handle customer created
 */
const handleCustomerCreated = async (event) => {
    const customer = event.data.object;
    
    await User.findOneAndUpdate(
        { email: customer.email },
        { stripeCustomerId: customer.id }
    );
    
    console.log(`✅ Customer created: ${customer.id}`);
};

/**
 * Handle customer updated
 */
const handleCustomerUpdated = async (event) => {
    const customer = event.data.object;
    
    await User.findOneAndUpdate(
        { stripeCustomerId: customer.id },
        {
            defaultPaymentMethodId: customer.invoice_settings?.default_payment_method,
            updatedAt: new Date()
        }
    );
    
    console.log(`🔄 Customer updated: ${customer.id}`);
};

/**
 * Main webhook handler
 */
const handleStripeWebhook = async (req, res) => {
    let event;
    
    try {
        event = verifyWebhookSignature(req);
    } catch (err) {
        return res.status(400).json({ success: false, message: `Webhook Error: ${err.message}` });
    }
    
    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            await handlePaymentSucceeded(event);
            break;
            
        case 'payment_intent.payment_failed':
            await handlePaymentFailed(event);
            break;
            
        case 'customer.subscription.created':
            await handleSubscriptionCreated(event);
            break;
            
        case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event);
            break;
            
        case 'customer.subscription.deleted':
            await handleSubscriptionCancelled(event);
            break;
            
        case 'invoice.payment_succeeded':
            await handleInvoicePaymentSucceeded(event);
            break;
            
        case 'invoice.payment_failed':
            await handleInvoicePaymentFailed(event);
            break;
            
        case 'customer.created':
            await handleCustomerCreated(event);
            break;
            
        case 'customer.updated':
            await handleCustomerUpdated(event);
            break;
            
        default:
            console.log(`⚠️ Unhandled event type: ${event.type}`);
    }
    
    res.json({ success: true, received: true });
};

module.exports = { handleStripeWebhook };