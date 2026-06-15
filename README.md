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

## Local use

Open `index.html` in a browser for the frontend, or run `server.py` locally if you want to use the Python proxy.

## About the project

This app is designed to help people improve their English through guided conversation, correction, and practice.