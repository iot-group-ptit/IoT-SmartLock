import cv2
import insightface
import numpy as np
import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import base64
import uvicorn
from pymongo import MongoClient

app = FastAPI(title="Face Verification API")

model = insightface.app.FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider'])
model.prepare(ctx_id=-1)
print("Model đã sẵn sàng!")

def extract_face_embedding(image_path):
    img = cv2.imread(image_path)
    if img is None:
        print(f"Không đọc được ảnh: {image_path}")
        return None
    faces = model.get(img)
    if not faces:
        return None
    return faces[0].embedding

def cosine_similarity(emb1, emb2):
    emb1 = np.array(emb1)
    emb2 = np.array(emb2)
    return np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))

mongo_uri = "mongodb+srv://van123:van123@smartlockdb.eevtzyc.mongodb.net/?appName=smartlockdb"
client = MongoClient(mongo_uri)
db = client["smartlock_db"]
collection = db["faces"]

known_embeddings = {}
print("Đang tải khuôn mặt từ MongoDB...")

for doc in collection.find():
    face_id = doc.get("face_id")
    user_id = doc.get("user_id")
    image_base64 = doc.get("image_base64")
    
    if not image_base64:
        continue

    image_bytes = base64.b64decode(image_base64)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if img is None:
        print(f"Không decode được ảnh {face_id}")
        continue 

    faces = model.get(img)
    if not faces:
        print(f"Không tìm thấy khuôn mặt {face_id}")
        continue

    emb = faces[0].embedding
    known_embeddings[face_id] = emb
    print(f"{face_id}")

print(f"\nĐã tải {len(known_embeddings)} khuôn mặt từ MongoDB!")


# ======= MODEL INPUT =======
class ImageBase64(BaseModel):
    image_base64: str


@app.post("/verify")
async def verify_face(data: ImageBase64):
    try:
        image_bytes = base64.b64decode(data.image_base64)
    except Exception:
        return JSONResponse({"status": "error", "message": "Base64 không hợp lệ"})

    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if img is None:
        return JSONResponse({"status": "error", "message": "Không decode được ảnh từ base64"})

    faces = model.get(img)
    if len(faces) == 0:
        return JSONResponse({"status": "error", "message": "Không tìm thấy khuôn mặt"})
    if len(faces) > 1:
        return JSONResponse({"status": "error", "message": "Ảnh có nhiều khuôn mặt"})

    embedding = faces[0].embedding

    best_name = "Unknown"
    best_sim = 0.0

    for name, emb in known_embeddings.items():
        print(f"Comparing with {name}...")
        sim = cosine_similarity(embedding, emb)
        if sim > best_sim:
            best_sim = sim
            best_name = name

    verified = best_sim >= 0.6
    
    return {
        "status": "success",
        "verified": bool(verified),
        "person": best_name if verified else "Unknown",
        "similarity": float(round(best_sim, 4))
    }


if __name__ == "__main__":
    uvicorn.run(
        "camera_api_2:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )