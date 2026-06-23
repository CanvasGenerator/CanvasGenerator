const fs = require('fs');
const path = require('path');

const schoolsPath = path.join(process.cwd(), 'schools.json');

function readSchools() {
    const raw = fs.readFileSync(schoolsPath, 'utf-8');
    return JSON.parse(raw);
}

function findSchoolById(id) {
    return readSchools().find((school) => school.id === id) || null;
}

module.exports = {
    readSchools,
    findSchoolById,
};
