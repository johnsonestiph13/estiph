/**
 * ESTIF HOME ULTIMATE - GITHUB WEBHOOK HANDLER
 * Handle GitHub events for CI/CD and deployment automation
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuration
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
const deployScriptPath = process.env.DEPLOY_SCRIPT_PATH || './scripts/deploy.sh';
const deployBranch = process.env.DEPLOY_BRANCH || 'main';

// Models
const Deployment = require('../../models/Deployment');
const ActivityLog = require('../../models/ActivityLog');

/**
 * Verify GitHub webhook signature
 */
const verifySignature = (req) => {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
        throw new Error('No signature found');
    }
    
    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
        throw new Error('Invalid signature');
    }
    
    return true;
};

/**
 * Trigger deployment
 */
const triggerDeployment = async (payload) => {
    const deployment = await Deployment.create({
        commitSha: payload.after,
        commitMessage: payload.head_commit?.message || 'Auto deployment',
        branch: payload.ref?.replace('refs/heads/', ''),
        author: payload.head_commit?.author?.name || 'GitHub',
        status: 'pending',
        startedAt: new Date()
    });
    
    try {
        // Execute deployment script
        const { stdout, stderr } = await execPromise(`${deployScriptPath} ${payload.after}`);
        
        await Deployment.findByIdAndUpdate(deployment._id, {
            status: 'success',
            completedAt: new Date(),
            output: stdout,
            error: stderr
        });
        
        console.log(`✅ Deployment successful: ${deployment._id}`);
    } catch (error) {
        await Deployment.findByIdAndUpdate(deployment._id, {
            status: 'failed',
            completedAt: new Date(),
            output: error.stdout,
            error: error.stderr || error.message
        });
        
        console.error(`❌ Deployment failed: ${deployment._id}`, error);
    }
};

/**
 * Handle push event
 */
const handlePushEvent = async (payload) => {
    const branch = payload.ref?.replace('refs/heads/', '');
    
    if (branch !== deployBranch) {
        console.log(`⏭️ Skipping deployment for branch: ${branch}`);
        return;
    }
    
    console.log(`📦 Push detected on ${branch}, triggering deployment...`);
    await triggerDeployment(payload);
};

/**
 * Handle pull request event
 */
const handlePullRequestEvent = async (payload) => {
    const action = payload.action;
    const pr = payload.pull_request;
    
    console.log(`🔄 Pull request ${action}: #${pr.number} - ${pr.title}`);
    
    // Run tests for PR
    if (action === 'opened' || action === 'synchronize') {
        try {
            const { stdout } = await execPromise('npm test');
            console.log(`✅ Tests passed for PR #${pr.number}`);
            
            // Add comment to PR
            // await addPRComment(pr.number, '✅ All tests passed!');
        } catch (error) {
            console.error(`❌ Tests failed for PR #${pr.number}`, error);
            // await addPRComment(pr.number, '❌ Tests failed. Please check your changes.');
        }
    }
};

/**
 * Handle issue event
 */
const handleIssuesEvent = async (payload) => {
    const action = payload.action;
    const issue = payload.issue;
    
    console.log(`📝 Issue ${action}: #${issue.number} - ${issue.title}`);
    
    // Auto-label issues
    if (action === 'opened') {
        const labels = [];
        
        if (issue.title.toLowerCase().includes('bug')) {
            labels.push('bug');
        }
        if (issue.title.toLowerCase().includes('feature') || issue.title.toLowerCase().includes('enhancement')) {
            labels.push('enhancement');
        }
        
        if (labels.length > 0) {
            // await addIssueLabels(issue.number, labels);
        }
    }
};

/**
 * Handle star event
 */
const handleStarEvent = async (payload) => {
    const action = payload.action;
    const repository = payload.repository;
    const sender = payload.sender;
    
    console.log(`⭐ Repository ${action} by ${sender.login}`);
    
    // Track stars for analytics
    await ActivityLog.create({
        action: `github_star_${action}`,
        details: {
            repository: repository.full_name,
            user: sender.login,
            stars: repository.stargazers_count
        }
    });
};

/**
 * Handle release event
 */
const handleReleaseEvent = async (payload) => {
    const action = payload.action;
    const release = payload.release;
    
    console.log(`📦 Release ${action}: ${release.tag_name} - ${release.name}`);
    
    if (action === 'published') {
        // Notify users about new release
        // await notifyUsers('new_release', {
        //     version: release.tag_name,
        //     notes: release.body
        // });
        
        // Update changelog
        // await updateChangelog(release);
    }
};

/**
 * Handle deployment status event
 */
const handleDeploymentStatusEvent = async (payload) => {
    const deployment = payload.deployment;
    const status = payload.deployment_status;
    
    console.log(`🚀 Deployment status: ${status.state} for ${deployment.ref}`);
    
    await Deployment.findOneAndUpdate(
        { commitSha: deployment.sha },
        {
            deploymentStatus: status.state,
            deploymentUrl: status.target_url,
            updatedAt: new Date()
        }
    );
};

/**
 * Main webhook handler
 */
const handleGitHubWebhook = async (req, res) => {
    try {
        // Verify signature in production
        if (process.env.NODE_ENV === 'production') {
            verifySignature(req);
        }
        
        const event = req.headers['x-github-event'];
        const payload = req.body;
        
        console.log(`📡 Received GitHub event: ${event}`);
        
        switch (event) {
            case 'push':
                await handlePushEvent(payload);
                break;
                
            case 'pull_request':
                await handlePullRequestEvent(payload);
                break;
                
            case 'issues':
                await handleIssuesEvent(payload);
                break;
                
            case 'star':
                await handleStarEvent(payload);
                break;
                
            case 'release':
                await handleReleaseEvent(payload);
                break;
                
            case 'deployment_status':
                await handleDeploymentStatusEvent(payload);
                break;
                
            default:
                console.log(`⚠️ Unhandled GitHub event: ${event}`);
        }
        
        res.json({ success: true, received: true });
    } catch (error) {
        console.error('GitHub webhook error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { handleGitHubWebhook };