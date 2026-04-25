const moment = require('moment');

const formatDate = (date, format = 'YYYY-MM-DD') => {
    return moment(date).format(format);
};

const formatDateTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
    return moment(date).format(format);
};

const parseDate = (dateString, format = 'YYYY-MM-DD') => {
    return moment(dateString, format).toDate();
};

const addDays = (date, days) => {
    return moment(date).add(days, 'days').toDate();
};

const subtractDays = (date, days) => {
    return moment(date).subtract(days, 'days').toDate();
};

const addHours = (date, hours) => {
    return moment(date).add(hours, 'hours').toDate();
};

const subtractHours = (date, hours) => {
    return moment(date).subtract(hours, 'hours').toDate();
};

const getDaysDifference = (date1, date2) => {
    return moment(date2).diff(moment(date1), 'days');
};

const getHoursDifference = (date1, date2) => {
    return moment(date2).diff(moment(date1), 'hours');
};

const getMinutesDifference = (date1, date2) => {
    return moment(date2).diff(moment(date1), 'minutes');
};

const getSecondsDifference = (date1, date2) => {
    return moment(date2).diff(moment(date1), 'seconds');
};

const isPast = (date) => {
    return moment(date).isBefore(moment());
};

const isFuture = (date) => {
    return moment(date).isAfter(moment());
};

const isToday = (date) => {
    return moment(date).isSame(moment(), 'day');
};

const isYesterday = (date) => {
    return moment(date).isSame(moment().subtract(1, 'day'), 'day');
};

const isTomorrow = (date) => {
    return moment(date).isSame(moment().add(1, 'day'), 'day');
};

const isThisWeek = (date) => {
    return moment(date).isSame(moment(), 'week');
};

const isThisMonth = (date) => {
    return moment(date).isSame(moment(), 'month');
};

const isThisYear = (date) => {
    return moment(date).isSame(moment(), 'year');
};

const getRelativeTime = (date) => {
    return moment(date).fromNow();
};

const getStartOfDay = (date) => {
    return moment(date).startOf('day').toDate();
};

const getEndOfDay = (date) => {
    return moment(date).endOf('day').toDate();
};

const getStartOfWeek = (date) => {
    return moment(date).startOf('week').toDate();
};

const getEndOfWeek = (date) => {
    return moment(date).endOf('week').toDate();
};

const getStartOfMonth = (date) => {
    return moment(date).startOf('month').toDate();
};

const getEndOfMonth = (date) => {
    return moment(date).endOf('month').toDate();
};

const getStartOfYear = (date) => {
    return moment(date).startOf('year').toDate();
};

const getEndOfYear = (date) => {
    return moment(date).endOf('year').toDate();
};

const getAge = (birthDate) => {
    return moment().diff(moment(birthDate), 'years');
};

const getWeekNumber = (date) => {
    return moment(date).isoWeek();
};

const getDayName = (date, locale = 'en') => {
    return moment(date).locale(locale).format('dddd');
};

const getMonthName = (date, locale = 'en') => {
    return moment(date).locale(locale).format('MMMM');
};

const getQuarter = (date) => {
    return moment(date).quarter();
};

const isValidDate = (date) => {
    return moment(date).isValid();
};

module.exports = {
    formatDate,
    formatDateTime,
    parseDate,
    addDays,
    subtractDays,
    addHours,
    subtractHours,
    getDaysDifference,
    getHoursDifference,
    getMinutesDifference,
    getSecondsDifference,
    isPast,
    isFuture,
    isToday,
    isYesterday,
    isTomorrow,
    isThisWeek,
    isThisMonth,
    isThisYear,
    getRelativeTime,
    getStartOfDay,
    getEndOfDay,
    getStartOfWeek,
    getEndOfWeek,
    getStartOfMonth,
    getEndOfMonth,
    getStartOfYear,
    getEndOfYear,
    getAge,
    getWeekNumber,
    getDayName,
    getMonthName,
    getQuarter,
    isValidDate
};