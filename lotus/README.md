# LOTUS Document Synthesis

Local Python environment for testing LOTUS semantic operators before deployment.

## Setup

1. **Install Python dependencies:**
   ```bash
   cd lotus
   pip install -r requirements.txt
   ```

   Or using conda (recommended for FAISS):
   ```bash
   conda create -n lotus python=3.10 -y
   conda activate lotus
   conda install -c pytorch faiss-cpu=1.8.0
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   Create a `.env` file in the project root (not in `lotus/`):
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   LOTUS_MODEL=gpt-4o-mini
   TEST_USER_ID=your_user_id_for_testing
   ```

   For LiteLLM models, also set:
   ```env
   OPENAI_API_KEY=your_openai_key  # For gpt-4o-mini
   # Or other provider keys as needed
   ```

## Usage

Run the test script:
```bash
python lotus/test_synthesis.py
```

This will:
1. Connect to Supabase
2. Fetch sample documents from your database
3. Run LOTUS `sem_agg` synthesis
4. Display the synthesized result

## Files

- `lotus_service.py` - Core LOTUS synthesis service
- `test_synthesis.py` - Local test script
- `requirements.txt` - Python dependencies

## Next Steps

After validating locally, the service will be deployed as:
- `api/lotus/index.py` - Vercel Python serverless function
- `api/lotus/synthesis.ts` - TypeScript proxy for auth and document fetching
