FROM python:3.11-slim

WORKDIR /app

# Install system deps needed by rembg's ONNX runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the u2netp model so the container is warm on first request
RUN python -c "from rembg import new_session; new_session('u2netp')"

COPY main.py .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
