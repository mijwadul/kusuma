import json
import base64
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from ...core.config import settings
from ...core.auth import get_current_user
from ...models import User

router = APIRouter()

class ExtractedReceipt(BaseModel):
    transaction_type: str | None = None
    date: str | None = None
    amount: float | None = None
    sender_name: str | None = None
    receiver_name: str | None = None
    reference_number: str | None = None
    notes: str | None = None
    netto: float | None = None
    bruto: float | None = None
    no_polisi: str | None = None
    tanggal_masuk: str | None = None
    tanggal_keluar: str | None = None

@router.post("/extract-receipt", response_model=ExtractedReceipt)
async def extract_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if not settings.GEMINI_API_KEY:
         raise HTTPException(status_code=500, detail="Gemini API Key is not configured")

    if file.content_type not in ["image/jpeg", "image/png", "image/webp", "image/jpg"]:
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, WEBP)")
    
    try:
        contents = await file.read()
        base64_data = base64.b64encode(contents).decode('utf-8')
        
        prompt = """
        You are an expert at extracting data from Indonesian receipts, bank transfers, and weighing tickets (Bukti Penimbangan).
        Analyze this image and extract the requested fields. 
        Return ONLY a valid JSON object without markdown formatting.
        
        Fields to extract:
        - transaction_type: "bank_transfer" or "weighing"
        - date: Transaction date (if available)
        - amount: Total amount transfered (numeric only, no currency symbols)
        - sender_name: Name of the sender (for transfers)
        - receiver_name: Name of the receiver (for transfers)
        - reference_number: Reference/Transaction number
        - notes: Any notes/berita/keterangan on the transfer
        - netto: Net weight numeric value (for weighing tickets)
        - bruto: Gross weight numeric value (for weighing tickets)
        - no_polisi: Vehicle number / No Polisi (for weighing tickets)
        - tanggal_masuk: Entry date/time (for weighing tickets)
        - tanggal_keluar: Exit date/time (for weighing tickets)
        
        If a field is not found in the image, set its value to null.
        """
        
        # Try multiple API versions and model names for compatibility
        # 2.0-flash models work (get 429=rate_limit when quota exceeded)
        # 1.5-flash series returns 404 for this API key type
        endpoints_to_try = [
            ("v1beta", "gemini-2.0-flash"),
            ("v1beta", "gemini-2.0-flash-lite"),
        ]
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": file.content_type,
                                "data": base64_data
                            }
                        }
                    ]
                }
            ]
        }
        
        resp = None
        last_error_text = ""
        async with httpx.AsyncClient(timeout=60.0) as client:
            for (api_ver, model_name) in endpoints_to_try:
                url = f"https://generativelanguage.googleapis.com/{api_ver}/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
                
                # Retry up to 3 times on 429 rate limit with backoff
                for attempt in range(3):
                    r = await client.post(url, json=payload)
                    print(f"Tried {api_ver}/{model_name} attempt {attempt+1} -> {r.status_code}")
                    if r.status_code == 200:
                        resp = r
                        break
                    elif r.status_code == 429:
                        if attempt < 2:
                            import asyncio
                            wait_secs = (attempt + 1) * 5  # 5s, then 10s
                            print(f"Rate limited, waiting {wait_secs}s before retry...")
                            await asyncio.sleep(wait_secs)
                            continue
                        else:
                            last_error_text = f"Rate limit exceeded after retries for {model_name}"
                            break
                    elif r.status_code == 404:
                        last_error_text = r.text
                        break  # Try next model
                    else:
                        raise Exception(f"Gemini API Error {r.status_code}: {r.text}")
                
                if resp is not None:
                    break
            
            if resp is None:
                raise Exception(f"Tidak dapat memproses gambar saat ini. {last_error_text}. Coba lagi dalam 1 menit.")
                    
            resp_json = resp.json()
            try:
                text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                raise Exception(f"Invalid response structure from Gemini: {resp.text}")
        
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        parsed_data = json.loads(text.strip())
        return parsed_data
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")
