# Use the official Python 3.10 image
FROM python:3.10

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . .

# Install dependencies (This also installs TensorFlow and OpenCV)
RUN pip install --no-cache-dir -r backend/requirements.txt

# Expose the port that Hugging Face Spaces expects
EXPOSE 7860

# Run the FastAPI application using Uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
