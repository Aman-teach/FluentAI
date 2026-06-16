# FluentAI

FluentAI is a personal AI English conversation coach. It helps people practice speaking, get real-time corrections, and build vocabulary with a simple web interface.

## What is included

- `index.html` for the main frontend
- `api/gemini.js` for the Gemini proxy endpoint
- `api/nvidia.js` for the NVIDIA proxy endpoint
- `server.py` for local Python-based proxy testing

## Deploy on Vercel

1. Push this repository to GitHub.
2. Import the repo into Vercel.
3. Keep the default framework settings or use a static deployment.
4. Add these environment variables in Vercel if you want server-side API access:
   - `GEMINI_API_KEY`
   - `NVIDIA_API_KEY`

## Supabase Setup

1. Open your Supabase project.
2. Go to the SQL editor and paste the contents of `supabase-schema.sql`.
3. Save the project URL and anon public key in the app's Settings screen under `Supabase Sync`.
4. Refresh the page and add a word to confirm the vocabulary is syncing.

The app stores vocabulary in Supabase and keeps a local cache in the browser so your words survive refreshes.

## Local use

Open `index.html` in a browser for the frontend, or run `server.py` locally if you want to use the Python proxy.

## About the project

This app is designed to help people improve their English through guided conversation, correction, and practice.