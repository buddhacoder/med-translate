FROM python:3.11-slim

WORKDIR /app

COPY requirements-cloud.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

# Railway sets PORT dynamically — don't hardcode
ENV PORT=8443
EXPOSE $PORT

CMD python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
