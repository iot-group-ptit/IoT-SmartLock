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
# ==============================================================
# 1️⃣  KHỞI TẠO MÔ HÌNH
# ==============================================================
print("Đang tải model InsightFace...")
model = insightface.app.FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider'])
model.prepare(ctx_id=-1)
print("✅ Model đã sẵn sàng!")


# ==============================================================
# 2️⃣  TRÍCH XUẤT EMBEDDING
# ==============================================================
def extract_face_embedding(image_path):
    img = cv2.imread(image_path)
    if img is None:
        print(f"Không đọc được ảnh: {image_path}")
        return None
    faces = model.get(img)
    if not faces:
        return None
    return faces[0].embedding


# ==============================================================
# 3️⃣  COSINE SIMILARITY
# ==============================================================
def cosine_similarity(emb1, emb2):
    emb1 = np.array(emb1)
    emb2 = np.array(emb2)
    return np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))




# ============================================================== 
# 4️⃣ LOAD DỮ LIỆU KHUÔN MẶT TỪ MONGODB
# ==============================================================

mongo_uri = "mongodb+srv://van123:van123@smartlockdb.eevtzyc.mongodb.net/?appName=smartlockdb"
client = MongoClient(mongo_uri)
db = client["smartlock_db"]
collection = db["faces"]

known_embeddings = {}
print("Đang tải khuôn mặt từ MongoDB...")
docs = collection.find()
# print(f"Tìm thấy {collection.count_documents({})} khuôn mặt trong MongoDB.")
for doc in collection.find():
    face_id = doc.get("face_id")
    user_id = doc.get("user_id")
    image_base64 = doc.get("image_base64")
    
    if not image_base64:
        continue

    # Decode base64 -> OpenCV image
    image_bytes = base64.b64decode(image_base64)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if img is None:
        print(f"  ❌ Không decode được ảnh {face_id}")
        continue

    # Trích embedding
    faces = model.get(img)
    if not faces:
        print(f"  ❌ Không tìm thấy khuôn mặt {face_id}")
        continue

    emb = faces[0].embedding
    known_embeddings[face_id] = emb
    print(f"  ✅ {face_id}")

print(f"\n📁 Đã tải {len(known_embeddings)} khuôn mặt từ MongoDB!")


# ======= MODEL INPUT =======
class ImageBase64(BaseModel):
    image_base64: str

class ActionRequest(BaseModel):
    image_base64: str
    initial_x: float
    direction: str = "left"

@app.post("/verify")
async def verify_face(data: ImageBase64):
    try:
        # 1. Giải mã base64 → bytes
        image_bytes = base64.b64decode(data.image_base64)
    except Exception:
        return JSONResponse({"status": "error", "message": "Base64 không hợp lệ"})

    # 2. Decode thành ảnh OpenCV
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if img is None:
        return JSONResponse({"status": "error", "message": "Không decode được ảnh từ base64"})

    # 3. Trích embedding
    faces = model.get(img)
    if len(faces) == 0:
        return JSONResponse({"status": "error", "message": "Không tìm thấy khuôn mặt"})
    if len(faces) > 1:
        return JSONResponse({"status": "error", "message": "Ảnh có nhiều khuôn mặt"})

    embedding = faces[0].embedding
    face = faces[0]
    x_center = (face.bbox[0] + face.bbox[2]) / 2
    # 4. So sánh với known_embeddings
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
        "verified": bool(verified),
        "person": best_name if verified else "Unknown",
        "similarity": float(round(best_sim, 4)),
        "initial_x": float(x_center)
    }

@app.post("/check-action")
def check_head_turn(data: ActionRequest):
    moved = False

    if data.direction not in ["left", "right"]:
        return JSONResponse({"status": "error", "message": "Hướng không hợp lệ. Chỉ chấp nhận 'left' hoặc 'right'."})

    if data.initial_x is None:
        return JSONResponse({"status": "error", "message": "initial_x không được để trống."})

    try:
        image_bytes = base64.b64decode(data.image_base64)
    except Exception:
        return JSONResponse({"status": "error", "message": "Base64 không hợp lệ"})

    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return JSONResponse({"status": "error", "message": "Không decode được ảnh từ base64"})

    faces = model.get(img)
    if len(faces) == 0:
        return JSONResponse({"status": "error", "message": "Không tìm thấy khuôn mặt"})
    if len(faces) > 1:
        return JSONResponse({"status": "error", "message": "Ảnh có nhiều khuôn mặt"})

    face = faces[0]
    x_center = (face.bbox[0] + face.bbox[2]) / 2
    delta = x_center - data.initial_x

    if (data.direction == "right" and delta > 40) or (data.direction == "left" and delta < -40):
        moved = True

    return {
        "moved": moved,
        "delta": float(delta)
    }


if __name__ == "__main__":
    uvicorn.run(
        "camera_api:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )