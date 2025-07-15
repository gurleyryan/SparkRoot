FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy entire project structure
COPY . .

# Create data directory if it doesn't exist
RUN mkdir -p data

# Download initial data
RUN python data/download_scryfall_data.py

# Expose port
EXPOSE 8000

# Run the application using the run.py script
CMD ["python", "run.py"]
