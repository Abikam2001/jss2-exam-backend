const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));

const DB_FILE = path.join(__dirname, 'results_database.json');

function readDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = { submissions: [], violations: [], snapshots: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.snapshots) parsed.snapshots = [];
    return parsed;
  } catch (err) {
    return { submissions: [], violations: [], snapshots: [] };
  }
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const MASTER_ANSWER_KEYS = {
  0: 1, 1: 2, 2: 2, 3: 1, 4: 1, 5: 1, 6: 0, 7: 1, 8: 0, 9: 2,
  10: 0, 11: 2, 12: 1, 13: 0, 14: 1, 15: 1, 16: 2, 17: 1, 18: 3, 19: 1,
  20: 1, 21: 2, 22: 2, 23: 1, 24: 1, 25: 1, 26: 1, 27: 2, 28: 0, 29: 3,
  30: 0, 31: 0, 32: 1, 33: 2, 34: 1, 35: 2, 36: 2, 37: 1, 38: 1, 39: 0
};

const AUTH_DATABASE = {
  teachers: ["TEA-MAN-9982", "INV-DIST4-2026"],
  students: Array.from({ length: 200 }, (_, i) => `STU-DIST4-${String(i + 1).padStart(3, '0')}`)
};

app.get('/', (req, res) => {
  res.send('MAN District IV Selection Test Server is Active!');
});

// AUTHENTICATION ENDPOINT WITH 9:45 AM TIME-LOCK
app.post('/api/auth', (req, res) => {
  const { role, passcode, candidateName, schoolName } = req.body;

  if (!candidateName || !passcode) {
    return res.status(400).json({ success: false, message: "Name and Passcode are required." });
  }

  // --- TIME-GATE LOCK (Sept 18, 2026 at 09:45 AM WAT) ---
  const now = new Date();
  const examOpenTime = new Date('2026-09-18T09:45:00+01:00');

  // Teachers/Invigilators can ALWAYS log in; Students are blocked until 9:45 AM
  if (role === 'student' && now < examOpenTime) {
    const minutesLeft = Math.ceil((examOpenTime - now) / (1000 * 60));
    return res.status(403).json({ 
      success: false, 
      message: `The portal is currently locked. Student authentication opens at 9:45 AM prompt (in approx. ${minutesLeft} mins).` 
    });
  }
  // ------------------------------------------------------

  if (role === 'student') {
    if (!schoolName) {
      return res.status(400).json({ success: false, message: "School Name is required." });
    }
    if (AUTH_DATABASE.students.includes(passcode.trim())) {
      return res.status(200).json({ success: true, candidateName, schoolName, role: "student" });
    }
    return res.status(401).json({ success: false, message: "Invalid Student Security Passcode." });
  }

  if (role === 'teacher') {
    if (AUTH_DATABASE.teachers.includes(passcode.trim())) {
      return res.status(200).json({ success: true, candidateName, role: "teacher" });
    }
    return res.status(401).json({ success: false, message: "Invalid Invigilator Passcode." });
  }

  return res.status(400).json({ success: false, message: "Invalid Role Selected." });
});

app.post('/api/proctor/log-violation', (req, res) => {
  const { candidateName, schoolName, violationType } = req.body;
  const db = readDatabase();
  
  db.violations.push({
    candidateName,
    schoolName: schoolName || "N/A",
    violationType,
    timestamp: new Date().toLocaleTimeString()
  });

  writeDatabase(db);
  return res.status(200).json({ logged: true });
});

app.post('/api/proctor/snapshot', (req, res) => {
  const { candidateName, schoolName, imageBase64, eventLabel } = req.body;
  const db = readDatabase();

  db.snapshots.push({
    candidateName,
    schoolName: schoolName || "N/A",
    imageBase64,
    eventLabel: eventLabel || "Routine Check",
    timestamp: new Date().toLocaleTimeString()
  });

  if (db.snapshots.length > 200) {
    db.snapshots = db.snapshots.slice(-200);
  }

  writeDatabase(db);
  return res.status(200).json({ success: true });
});

app.post('/api/exam/submit', (req, res) => {
  const { candidateName, schoolName, answers } = req.body;
  
  let score = 0;
  const totalQuestions = Object.keys(MASTER_ANSWER_KEYS).length;

  Object.keys(MASTER_ANSWER_KEYS).forEach(qIdx => {
    if (answers[qIdx] !== undefined && parseInt(answers[qIdx]) === MASTER_ANSWER_KEYS[qIdx]) {
      score++;
    }
  });

  const percentage = ((score / totalQuestions) * 100).toFixed(1);
  const db = readDatabase();
  
  const studentViolations = db.violations.filter(v => v.candidateName === candidateName).length;

  const resultRecord = {
    candidateName,
    schoolName: schoolName || "N/A",
    score,
    totalQuestions,
    percentage,
    violations: studentViolations,
    submittedAt: new Date().toLocaleString()
  };

  const existingIdx = db.submissions.findIndex(s => s.candidateName.toLowerCase() === candidateName.toLowerCase() && s.schoolName.toLowerCase() === schoolName.toLowerCase());
  
  if (existingIdx !== -1) {
    db.submissions[existingIdx] = resultRecord;
  } else {
    db.submissions.push(resultRecord);
  }

  writeDatabase(db);
  return res.status(200).json({ success: true, score, totalQuestions, percentage });
});

app.get('/api/teacher/results', (req, res) => {
  const db = readDatabase();
  return res.status(200).json({
    totalSubmissions: db.submissions.length,
    submissions: db.submissions,
    recentViolations: db.violations,
    snapshots: db.snapshots
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MAN District IV Competition Server running on port ${PORT}`));
