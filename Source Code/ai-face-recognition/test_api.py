import base64
import requests

def image_to_base64(image_path):
    with open(image_path, "rb") as img_file:
        base64_string = base64.b64encode(img_file.read()).decode("utf-8")
    return base64_string


# ----- 1. Chuyển ảnh sang base64 -----
path = r"C:\HK7\IOT\smart_lock_door\dao_thi_huyen_2.jpg"
b64_image = image_to_base64(path)


# ----- 2. Gọi API verify -----
url = "http://localhost:8000/verify"  

payload = {
    "image_base64": b64_image
}

response = requests.post(url, json=payload)

# ----- 3. In kết quả -----
print("Kết quả API:")
print(response.text)
