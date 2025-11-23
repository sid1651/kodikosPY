FROM python:3.11-slim

# System dependencies for numpy, scipy, matplotlib
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir \
    numpy \
    matplotlib \
    pillow \
    pandas \
    opencv-python-headless \
    requests \
    python-dateutil \
    scipy

COPY run.py /app/run.py

CMD ["python3", "/app/run.py"]
