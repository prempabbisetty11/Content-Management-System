# CMS Application

A simple Content Management System with user authentication.

## Setup

1. Install Node.js from https://nodejs.org/

2. Run `npm install` to install dependencies.

3. Configure email in `server.js`:
   - Replace `'your-app-password'` in the transporter config with your Gmail app password (enable 2FA and generate app password for 'premsai620@gmail.com').

4. Run `npm start` to start the server on port 3000.

5. Open `http://localhost:3000/page.html` in your browser.

## Features

- Login with email and password (select User or Admin login type).
- Admin login requires PIN (1234) and admin role.
- Forgot password with OTP reset.
- Content creation and management (shared among users).
- Admin panel for administrators.

## Database

Uses SQLite database (`cms.db`) with tables:
- `users`: id, name, username, email, phone, password, role (user/admin)
- `otps`: id, email, otp, type
- `contents`: id, title, body, author, date# Content-Management-System
