# Hire Me Pls

**Hire Me Pls** is an AI-powered resume analyzer, scorer, and rewriter designed to help you optimize your resume for Applicant Tracking Systems (ATS). It leverages modern web technologies and Google's Gemini AI model to provide actionable insights, intelligent bullet rewrites, and version tracking for your resumes.

---

## 🌟 Features

- **ATS Readiness Scoring**: Get a detailed score evaluating how well your resume matches industry standards.
- **AI Bullet Rewriter**: Instantly transform generic bullet points into quantified, impactful statements.
- **Keyword Optimization**: Identify missing keywords and hard skills required for your target roles.
- **Version Tracking**: Maintain a full history of your resume iterations, compare versions, and see visual diffs.
- **Insightful Dashboard**: View score evolution charts and track your progress over time.
- **PDF Uploads**: Seamlessly parse and extract content from your PDF resumes.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: React 19 (via Vite)
- **Styling**: Tailwind CSS, Framer Motion (for animations)
- **Routing**: React Router v7
- **State & Data Fetching**: TanStack React Query, Axios
- **Charts & Visualization**: Recharts

### Backend
- **Runtime**: Node.js & Express.js
- **Database**: MongoDB (Mongoose)
- **AI Integration**: Google Gemini API (`@google/genai`)
- **File Parsing**: `multer`, `pdf-parse`
- **Authentication**: JWT, bcrypt

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- MongoDB (local or Atlas cluster)
- A Google Gemini API Key

### 1. Clone the repository

```bash
git clone https://github.com/aswin-m-kumar/Hire_Me_Pls.git
cd Hire_Me_Pls
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory with the following variables:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Run the backend server:

```bash
npm run dev
```

### 3. Frontend Setup

Open a new terminal window and navigate to the frontend directory:

```bash
cd frontend/ai-resume-checker-ui-boilerplate-code
npm install
```

Start the frontend development server:

```bash
npm run dev
```

Your frontend should now be running at `http://localhost:5173` (or similar).

---

## 📂 Project Structure

```text
Hire_Me_Pls/
├── backend/                  # Express.js REST API
│   ├── src/
│   │   ├── config/           # DB & Environment variables
│   │   ├── middleware/       # Auth, Uploads, Error Handling
│   │   ├── models/           # Mongoose schemas (User, Resume, Analysis)
│   │   ├── routes/           # API Endpoints
│   │   ├── services/         # AI Logic, PDF parsing, Diff tracking
│   │   └── server.js         # Entry point
│   └── package.json
│
└── frontend/
    └── ai-resume-checker-ui-boilerplate-code/  # React App
        ├── src/
        │   ├── api/          # Axios API clients
        │   ├── components/   # UI & Layout components
        │   ├── context/      # Auth & Theme providers
        │   ├── hooks/        # Custom React Query hooks
        │   ├── pages/        # Dashboard, Resume Details, Login, etc.
        │   └── main.jsx
        ├── index.html
        └── package.json
```

---

## 🤝 Credits

A special thanks to **Time to Program** for the guidance and inspiration. This project was built by following and adapting their video tutorial:  
[YouTube: Time to Program - AI Resume Checker](https://youtu.be/U5E8_Wwmg2A?si=GoXfFxOShsUswzqa)
