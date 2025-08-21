// backend/config/defaultImages.js
const { CLIENT_BASE_URL } = require('./env');

function getDefaultProfileImageUrl(gender) {
    if (gender === 'male') {
        return `${CLIENT_BASE_URL}/img/default_profile_male.png`;
    } else if (gender === 'female') {
        return `${CLIENT_BASE_URL}/img/default_profile_female.png`;
    }
    return `${CLIENT_BASE_URL}/img/default_profile_guest.png`;
}

module.exports = {
    getDefaultProfileImageUrl
};