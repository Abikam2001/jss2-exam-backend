const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allows base64 image payload upload

const ACTIVE_PASSCODES = {
  student: "STU-JSS2-2026",
  teacher: "TEA-MAN-9982"
};

// 1. Authenticate Access Codes
app.post('/api/auth', (req, res) => {
  const { role, passcode, candidateName } = req.body;
  if (ACTIVE_PASSCODES[role] && ACTIVE_PASSCODES[role] === passcode) {
    return res.status(200).json({ success: true, token: "JWT_SESSION_TOKEN_EXAMPLE" });
  }
  return res.status(401).json({ success: false, message: "Invalid Security Code" });
});

// 2. Upload Proctoring Snapshot & Verify Room/Face
app.post('/api/proctor/verify', (req, res) => {
  const { candidateId, imageBase64 } = req.body;
  // Store image in S3/Cloudinary bucket & register candidate session
  console.log(`Received proctoring snapshot for Candidate: ${candidateId}`);
  return res.status(200).json({ status: "Verified", sessionId: "SESS_10023" });
});

// 3. Log Security Violations (Tab switching, loss of focus)
app.post('/api/proctor/log-violation', (req, res) => {
  const { candidateId, violationType } = req.body;
  console.warn(`SECURITY ALERT: ${candidateId} triggered ${violationType}`);
  return res.status(200).json({ logged: true });
});

app.listen(3000, () => console.log('Proctoring Server running on port 3000'));
