# Toronto Policy Sandbox (Genesis26)

A full-stack, AI-driven city simulation platform that lets users propose urban policies and watch the cascading effects unfold in real-time. The application combines a multi-agent LLM backend with a responsive, data-driven 3D visualization of the Toronto skyline.

## Architecture

The project is split into two tightly coupled domains:

### Frontend (`/frontend`)
A modern Next.js application leveraging React, Zustand, and React Three Fiber.
- **3D Visualization:** A dynamic, physical representation of Toronto (featuring landmarks like the CN Tower, Rogers Centre, City Hall, and Gooderham Flatiron). The 3D scene responds natively to 5 simulated aggregate metrics:
  - **Emissions:** Maps to a dynamic 5-tier volumetric fog/smog system and animating sky colors.
  - **Congestion:** Translates to kinetic particle traffic flow along the Gardiner Expressway.
  - **Social Equity:** Represented by ground plane color lerping and a "Vitality Field" of rising/hovering particles.
  - **Energy Health:** Drives the emissive glow of downtown towers, ranging from steady cyan pulses to rolling blackout flickers.
  - **Financial Stability:** Reflected in the structural integrity of buildings (deflation scales and glitching wireframe overlays).
- **Interface:** Allows users to submit open-ended policy text, view active scenarios, and inspect granular AI agent thought traces.

### Backend (`/engine`)
A Python-based FastAPI WebSockets server driving the simulation via LLM multi-agent reasoning.
- **Multi-Agent Simulation:** Uses `openai/gpt-oss-120b` (or other OpenAI-compatible endpoints) strictly outputting structured JSON to evaluate policies across different municipal domains (e.g., environmental, social, fiscal).
- **State Management:** Aggregates individual agent impact deltas into global metrics (Emissions, Congestion, Equity, Peak Demand, Fiscal Cost).
- **Real-Time Streaming:** Streams reasoning traces, confidence scores, and updated geographic city states directly to the React frontend over WebSockets.

## Getting Started

### Prerequisites
- Node.js (for Next.js frontend)
- Python 3.10+ (for FastAPI backend)

### Backend Setup
1. Navigate to the `engine/` directory.
2. (Optional but recommended) Create a virtual environment and activate it.
3. Install dependencies:
   ```bash
   pip install fastapi uvicorn openai python-dotenv pydantic
   ```
4. Create a `.env` file with your LLM API keys. By default, the system is configured to use a HuggingFace Inference Endpoint for `openai/gpt-oss-120b`.
   ```env
   OPENAI_API_KEY=your_key_here
   ```
5. Run the FastAPI server:
   ```bash
   # Make sure your entry point matches your server filename, e.g.
   uvicorn main:app --reload 
   ```
   *The WebSocket server runs on `ws://localhost:8000/ws/simulation`.*

### Frontend Setup
1. Navigate to the `frontend/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` in your browser.

## Features & Usage
1. **Load the Dashboard:** The simulation starts with a baseline Toronto layout at a theoretical 50% "status quo" health across all metrics.
2. **Propose Policies:** Use the chat sidebar (or predefined policy chips) to introduce new city ordinances (e.g., "Implement free public transit on weekends" or "Zone the waterfront for cryptocurrency mining").
3. **Observe AI Reasoning:** Watch as different municipal AI domains independently evaluate the prompt.
4. **Witness the Impact:** The city's aggregate score updates, immediately triggering spectacular visual feedback in the 3D skyline representing the success or collapse of the metropolis.
