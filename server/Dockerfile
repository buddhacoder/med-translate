FROM nvidia/cuda:12.4.1-devel-ubuntu22.04

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv libopus-dev git \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Clone and install PersonaPlex moshi package
RUN git clone https://github.com/NVIDIA/personaplex.git /tmp/personaplex \
    && pip3 install /tmp/personaplex/moshi/. \
    && rm -rf /tmp/personaplex

COPY app/ ./app/

EXPOSE 8443

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8443"]
