import threading
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response

app = FastAPI()
_session = None
_remove = None

# Defer rembg imports + model load into a background thread so uvicorn
# starts immediately (rembg imports numpy/onnxruntime/opencv which are slow)
def _load_model():
    global _session, _remove
    try:
        import logging
        logging.basicConfig(level=logging.INFO)
        log = logging.getLogger("model")
        log.info("Starting model load...")
        from rembg import remove, new_session
        log.info("rembg imported, loading u2netp session...")
        _session = new_session("u2netp")
        _remove = remove
        log.info("Model ready.")
    except Exception as e:
        import traceback
        print(f"[model] FAILED: {e}")
        traceback.print_exc()

threading.Thread(target=_load_model, daemon=True).start()


@app.post("/remove-bg")
async def remove_bg(image_file: UploadFile = File(...)):
    if _session is None:
        raise HTTPException(status_code=503, detail="Model still loading, try again in ~90s")
    if not image_file.content_type or not image_file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    data = await image_file.read()
    result = _remove(data, session=_session)
    return Response(content=result, media_type="image/png")


@app.get("/health")
async def health():
    return {"status": "ok" if _session is not None else "loading"}
