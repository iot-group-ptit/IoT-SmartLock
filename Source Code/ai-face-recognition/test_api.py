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

# ----- 3. Check action-----
print("Kết quả API:")
result = response.json()
print(result)
if result.get("verified") == True:

    initial_x = result.get("initial_x")
    url_action = "http://localhost:8000/check-action"
    left_path = r"C:\HK7\IOT\smart_lock_door\left.jpg"
    b64_image_left = image_to_base64(left_path)

    payload_action = {
        "initial_x": initial_x,
        "direction": "left",
        "image_base64" : b64_image_left
    }
    response_action = requests.post(url_action, json=payload_action)
    result_action = response_action.json()
    print("Kết quả check action:")
    print(result_action)

