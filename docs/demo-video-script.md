# One-Minute How-It-Works Video

Use this as the production script for the launch video. Record against staging or production with fictional data only.

## Goal

Show a candidate moving from job posting to interview-ready in under one minute.

## Recording Setup

- Tool: Screen Studio preferred; browser capture is acceptable.
- Resolution: 1920x1080 or higher.
- Browser: clean profile, bookmarks bar hidden, no extensions visible.
- Data: fictional job posting, fictional resume, no personal email, no API keys, no console.
- Audio: optional. The captions below can carry the story if you launch without voiceover.

## Demo Data

**Role:** Senior Solutions Engineer  
**Company:** NimbusData  
**Stage:** Hiring manager interview  
**Resume persona:** Alex Rivera, senior solutions engineer with cloud, DevTools, and enterprise POC experience.

## Shot List

| Time | Screen | Caption / Voiceover |
|---|---|---|
| 0-5s | Landing hero | "InterviewIntel turns a job posting into focused interview prep." |
| 5-12s | New Session, paste job posting | "Paste the role or bring in the posting URL." |
| 12-20s | Attach resume | "Add your resume so the prep is grounded in your actual experience." |
| 20-28s | Auto-fill company, role, stage | "The app extracts the role, company, and likely interview stage." |
| 28-38s | Generated analysis | "Get the likely interview focus, risks, and story angles." |
| 38-47s | Answer framework | "Turn your experience into concise, role-specific STAR answers." |
| 47-56s | Role-play | "Practice with an interviewer-style prompt and get scored feedback." |
| 56-60s | Scorecard and CTA | "Walk in with a sharper story. Start your prep in minutes." |

## Edit Notes

- Keep every click intentional. Avoid showing load waits longer than 1 second; cut through generation time.
- Use 1-2 gentle zooms: one on resume/job input, one on scorecard feedback.
- Export with captions burned in if no voiceover is recorded.
- Upload to YouTube as **Unlisted**.
- Set `VITE_DEMO_VIDEO_ID` in Vercel to the YouTube video id.
- Redeploy the frontend and verify the landing embed on desktop and mobile.

## Acceptance Criteria

- The video is 45-70 seconds.
- The first 5 seconds explain the product.
- The resume upload and role-play value are visible.
- No secrets, real personal data, browser console, or internal dashboard URLs appear.
- The YouTube embed loads on `https://interviewintel.ai/`.
