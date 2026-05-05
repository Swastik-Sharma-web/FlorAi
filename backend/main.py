from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import io
from pathlib import Path

# Add the parent directory to Python path so we can import from `training`
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

# Import the prediction module we just built
try:
    from predict import predict_disease
except ImportError:
    try:
        from backend.predict import predict_disease
    except ImportError:
        print("Warning: Could not import predict_disease. Make sure the file exists.")
    
app = FastAPI(title="AI-Powered Plant Disease Detection API")

# Step 7 Requirement: Configure CORS so the frontend can easily communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, change this to specific domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionResponse(BaseModel):
    disease: str
    confidence: float
    health_status: str
    suggestion: str



@app.post("/api/predict", response_model=PredictionResponse)
async def api_predict_plant_disease(
    file: UploadFile = File(...),
    latitude: float = Form(None),
    longitude: float = Form(None),
    region: str = Form(None)
):
    """
    Endpoint mapping to receive an uploaded leaf image and returning prediction with location support.
    """
    try:
        # Read the uploaded image payload as bytes
        image_data = await file.read()
        image_stream = io.BytesIO(image_data)
        
        # Step 6 Integration: Call our prediction module
        # The predict_disease function pre-processes the image, runs the CNN, 
        # and formats the output into a dictionary perfectly matching our PredictionResponse model.
        result_dict = predict_disease(image_stream, latitude=latitude, longitude=longitude, region=region)
        
        # Temporarily expose the exact error in the suggestion field for debugging
        if "error" in result_dict:
            return PredictionResponse(
                disease="DEBUG ERROR",
                confidence=0.0,
                health_status="Error",
                suggestion=str(result_dict["error"])
            )
            
        return PredictionResponse(**result_dict)
        
    except Exception as e:
        return PredictionResponse(
            disease="Processing Failed",
            confidence=0.0,
            health_status="Error",
            suggestion=str(e)
        )

from fastapi.staticfiles import StaticFiles

# Serve the static files
frontend_path = BASE_DIR / "frontend"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
else:
    @app.get("/")
    async def read_root():
        return {"message": "Welcome to the FlorAI Plant Disease Detection API! (Frontend not found)"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
