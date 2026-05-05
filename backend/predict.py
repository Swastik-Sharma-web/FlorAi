import os
from pathlib import Path
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.image import img_to_array
from tensorflow.keras.models import load_model
from PIL import Image
import cv2
from dotenv import load_dotenv
import google.generativeai as genai
from dotenv import load_dotenv
import google.generativeai as genai

# Setup Paths
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "plant_disease_model.h5"
DATASETS_DIR = BASE_DIR / "datasets"

# Global Variables
IMG_SIZE = (224, 224)
MODEL = None
CLASS_NAMES = None

# Dictionary to hold advice corresponding to standard classes
# (Expand this dictionary based on your actual dataset folders)
ADVICE_DB = {
    "Healthy": "Plant appears very healthy. Continue optimal watering and nutrient management practices.",
    "Early Blight": "Apply appropriate fungicide containing chlorothalonil or copper. Remove and destroy infected lower leaves. Ensure adequate spacing.",
    "Late Blight": "Apply protective fungicides immediately. Remove and destroy all infected plant parts. Do not compost infected material.",
    "Powdery Mildew": "Apply sulfur or potassium bicarbonate based fungicides. Ensure good air circulation and avoid overhead watering.",
    "Leaf Spot": "Remove infected leaves. Apply copper-based fungicide. Avoid wetting the foliage when watering.",
    "Scab": "Apply fungicides like captan or mancozeb. Rake and destroy fallen leaves to reduce overwintering fungi.",
    "Rust": "Remove infected leaves. Apply a copper-based or sulfur fungicide. Avoid overhead watering to keep leaves dry.",
    "Black Rot": "Prune out infected canes or vines. Apply fungicides early in the season. Ensure good canopy management for airflow."
}

def get_gemini_advisory(disease_name, in_india=False, region_name=None):
    env_path = BASE_DIR / ".env"
    load_dotenv(dotenv_path=env_path, override=True)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: return None
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"You are an expert botanist and agricultural advisor. A farmer has detected '{disease_name}' in their crop."
        if region_name and "Unknown" not in region_name:
            prompt += f" The farm is located in this geographic region: {region_name}. Deduce the dominant native agricultural soil type for this region and customize your advice based on how that specific soil interacts with the disease."
        prompt += " Provide a short, practical, and highly actionable 3-sentence advisory on how to treat this disease and prevent it from spreading."
        if in_india:
            prompt += " Include at least one reference to an organic Indian agricultural practice (like Neem oil or Jeevamrutha)."
        response = model.generate_content(prompt, generation_config=genai.GenerationConfig(temperature=0.3))
        if response and response.text: return response.text.strip().replace('\n', ' ')
    except Exception as e: print(f"Gemini Text Error: {e}")
    return None

def get_gemini_vision_advisory(pil_img, region_name=None):
    env_path = BASE_DIR / ".env"
    load_dotenv(dotenv_path=env_path, override=True)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: return None
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = "Analyze this image. Identify the exact plant species and definitively diagnose any visible diseases or nutritional deficiencies. Then, prescribe a clear, practical 3-sentence recommendation."
        if region_name and "Unknown" not in region_name:
            prompt += f" Context: The plant is growing in {region_name}. Integrate the region's typical native soil properties (e.g., pH, clay/sand density) into your diagnosis and cure."
        response = model.generate_content([prompt, pil_img])
        if response and response.text: return response.text.strip().replace('\n', ' ')
    except Exception as e: print(f"Gemini Vision Error: {e}")
    return None

def is_in_india(latitude, longitude):
    if latitude is None or longitude is None: return False
    try:
        lat, lon = float(latitude), float(longitude)
        return (8.4 <= lat <= 37.6) and (68.7 <= lon <= 97.2)
    except Exception: return False

def load_prediction_model():
    """Lazy load the model to speed up backend startup"""
    global MODEL
    if MODEL is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found at {MODEL_PATH}. Train the model first.")
        print("Loading deep learning model into memory...")
        MODEL = load_model(str(MODEL_PATH))
    return MODEL

def load_class_names():
    """
    Dynamically load class names.
    Since datasets are not deployed, we hardcode the 38 PlantVillage classes.
    """
    global CLASS_NAMES
    if CLASS_NAMES is None:
        CLASS_NAMES = [
            'Apple___Apple_scab', 'Apple___Black_rot', 'Apple___Cedar_apple_rust', 'Apple___healthy', 
            'Blueberry___healthy', 'Cherry_(including_sour)___Powdery_mildew', 'Cherry_(including_sour)___healthy', 
            'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 'Corn_(maize)___Common_rust_', 
            'Corn_(maize)___Northern_Leaf_Blight', 'Corn_(maize)___healthy', 'Grape___Black_rot', 
            'Grape___Esca_(Black_Measles)', 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)', 'Grape___healthy', 
            'Orange___Haunglongbing_(Citrus_greening)', 'Peach___Bacterial_spot', 'Peach___healthy', 
            'Pepper,_bell___Bacterial_spot', 'Pepper,_bell___healthy', 'Potato___Early_blight', 
            'Potato___Late_blight', 'Potato___healthy', 'Raspberry___healthy', 'Soybean___healthy', 
            'Squash___Powdery_mildew', 'Strawberry___Leaf_scorch', 'Strawberry___healthy', 
            'Tomato___Bacterial_spot', 'Tomato___Early_blight', 'Tomato___Late_blight', 'Tomato___Leaf_Mold', 
            'Tomato___Septoria_leaf_spot', 'Tomato___Spider_mites Two-spotted_spider_mite', 'Tomato___Target_Spot', 
            'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato___Tomato_mosaic_virus', 'Tomato___healthy'
        ]
    return CLASS_NAMES

def is_leaf_detected(image_file):
    """
    OpenCV HSV Color masking to verify if the uploaded image is actually a plant leaf.
    Checks for minimum thresholds of Green and Brown/Yellow.
    """
    try:
        # Save stream state
        current_pos = image_file.tell()
        image_file.seek(0)
        
        # Read to memory for cv2
        file_bytes = np.asarray(bytearray(image_file.read()), dtype=np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        
        # Restore stream for Keras
        image_file.seek(current_pos)
        
        if img is None:
            return False
            
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # Green mask
        lower_green = np.array([25, 40, 40])
        upper_green = np.array([90, 255, 255])
        mask_green = cv2.inRange(hsv, lower_green, upper_green)
        
        # Brown/Yellow mask
        lower_brown = np.array([10, 40, 40])
        upper_brown = np.array([30, 255, 255])
        mask_brown = cv2.inRange(hsv, lower_brown, upper_brown)
        
        # Calculate percentage
        green_ratio = cv2.countNonZero(mask_green) / (img.shape[0] * img.shape[1])
        brown_ratio = cv2.countNonZero(mask_brown) / (img.shape[0] * img.shape[1])
        
        # A leaf should have some green, OR a very high amount of brown/yellow
        return green_ratio > 0.05 or (green_ratio > 0.01 and brown_ratio > 0.1)
    except Exception as e:
        print(f"Leaf check error: {e}")
        return True # Fallback to true if parsing fails so the AI can still try

def predict_disease(image_file, latitude=None, longitude=None, region=None):
    """
    Takes an uploaded image file (bytes), preprocesses it, 
    runs prediction, and formats the output.
    """
    try:
        in_india = is_in_india(latitude, longitude)
        # Load and verify model & classes
        model = load_prediction_model()
        classes = load_class_names()
        
        # 1. Load and preprocess image
        # image_file should be standard binary IO
        img = Image.open(image_file)
        if img.mode != "RGB":
            img = img.convert("RGB")
            
        img = img.resize(IMG_SIZE)
        img_array = img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0) # Add batch dimension
        img_array = img_array / 255.0 # Rescale 0-1
        
        # 2. Predict
        predictions = model.predict(img_array)
        class_idx = np.argmax(predictions[0])
        confidence = float(np.max(predictions[0]))
        
        predicted_class_name = classes[class_idx]
        
        # 3. Format Output Status and Advice
        is_healthy = "healthy" in predicted_class_name.lower()
        health_status = "Healthy" if is_healthy else "Diseased"
        
        # Friendly disease name (remove underscores etc if datasets used them)
        friendly_disease_name = predicted_class_name.replace("_", " ").title()
        if is_healthy:
            friendly_disease_name = "None"
            
        # OOD Check 1: Explicit Non-Leaf Rejection
        if not is_leaf_detected(image_file):
            return {
                "disease": "Prediction Failed",
                "confidence": 0.0,
                "health_status": "Invalid",
                "suggestion": "The system could not detect a leaf in this image. Please upload a clear photo of a plant leaf."
            }
            
        # OOD Check 2: Low Confidence Rejection Threshold / Unknown Plant Fallback
        if confidence < 0.60:
            vision_result = get_gemini_vision_advisory(img, region)
            if vision_result:
                return {
                    "disease": "AI Vision Scan",
                    "confidence": 0.99,
                    "health_status": "Uncertain (Cloud AI)",
                    "suggestion": f"✨ VISION DIAGNOSIS: {vision_result}"
                }
            return {
                "disease": "Unknown",
                "confidence": round(confidence, 4),
                "health_status": "Uncertain",
                "suggestion": "The system has low confidence and the Cloud AI is inaccessible. Please upload a clearer image."
            }
        
        # Find closest matching advice from DB, default to generic betterment
        static_advice = "Ensure optimal sunlight and water conditions. Prune any heavily infected or damaged leaves to prevent spread, and monitor the plant's recovery closely."
        if is_healthy:
            static_advice = ADVICE_DB["Healthy"]
        else:
            for key, val in ADVICE_DB.items():
                if key.lower() in friendly_disease_name.lower():
                    static_advice = val
                    break
            if in_india:
                static_advice += " Additionally, organic Indian agricultural practices suggest using Jeevamrutha to revitalize soil microflora."
                    
        # Replace static with dynamic text AI if available
        final_advice = static_advice
        if not is_healthy:
            gemini_advice = get_gemini_advisory(friendly_disease_name, in_india, region)
            if gemini_advice:
                final_advice = f"✨ AI ADVISORY: {gemini_advice}"

        # 4. Return formatted JSON dictionary
        return {
            "disease": friendly_disease_name,
            "confidence": round(confidence, 4),
            "health_status": health_status,
            "suggestion": final_advice
        }

    except Exception as e:
        print(f"Prediction Error: {e}")
        return {
            "error": str(e),
            "disease": "Unknown",
            "confidence": 0.0,
            "health_status": "Error",
            "suggestion": "System failed to process the image."
        }
