FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_MODE=kiosco

RUN pip install --no-cache-dir psycopg2-binary

COPY backend/ /app/backend/
COPY web/ /app/web/
COPY web-master/ /app/web-master/

WORKDIR /app

EXPOSE 8000

CMD ["python3", "/app/backend/server.py"]
