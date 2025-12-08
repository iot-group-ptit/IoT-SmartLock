/*
 * ========================================
 * ESP32 SMART LOCK 
 * ========================================
 * Features: RFID, Fingerprint, Face Recognition
 * Security: X.509 Certificate Authentication
 * Protocol: MQTT over TLS
 * ========================================
 */
#define MQTT_MAX_PACKET_SIZE 2048  

// ========================================
// LIBRARIES
// ========================================

#include <SPI.h>
#include <MFRC522.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

#include "mbedtls/pk.h"
#include "mbedtls/entropy.h"
#include "mbedtls/ctr_drbg.h"
#include "mbedtls/rsa.h"
#include "mbedtls/md.h"
#include "mbedtls/base64.h"
#include "SPIFFS.h"  
#include "mbedtls/x509_crt.h"  

// ========================================
// CONFIGURATION
// ========================================

// WiFi
const char* ssid = "DTH";
const char* password = "huyendang2k4";

// MQTT Broker
const char* mqtt_server = "6c6c58328eae454b8e3f8680129d7d32.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "smart_lock_nhom7_iot";
const char* mqtt_password = "Nhom7iot";

// Biến lưu trữ
String device_id = "ESP32_SMARTLOCK_001";

// MQTT Topics
const char* topic_status = "smartlock/status";
const char* topic_fingerprint = "smartlock/sensor/fingerprint";
const char* topic_rfid = "smartlock/sensor/rfid";
const char* topic_command = "smartlock/control";
const char* topic_face_unlock = "smartlock/sensor/face/unlock";
const char* topic_enroll_rfid = "smartlock/enroll/rfid";
const char* topic_unlock = "smartlock/control/unlock";
const char* topic_enroll_fingerprint = "smartlock/enroll/fingerprint";
const char* topic_enroll_fingerprint_result = "smartlock/enroll/fingerprint/result";
const char* topic_delete_fingerprint = "smartlock/delete/fingerprint";
const char* topic_delete_fingerprint_result = "smartlock/delete/fingerprint/result";
const char* topic_device_provision_req = "smartlock/device/provision/request";
const char* topic_device_provision_res = "smartlock/device/provision/response";
const char* topic_device_finalize_req = "smartlock/device/finalize/request";
const char* topic_device_finalize_res = "smartlock/device/finalize/response";
const char* topic_device_provision_token = "smartlock/device/provision/token";
const char* topic_device_login = "smartlock/device/login";
const char* topic_device_login_response = "smartlock/device/login/response";
const char* topic_device_heartbeat = "smartlock/device/heartbeat";

// Hardware Pins
#define RELAY_PIN 14
#define FINGER_RX 17
#define FINGER_TX 16
#define SS_PIN   2
#define RST_PIN  4

// File paths
const char* PRIVATE_KEY_FILE = "/private_key.pem";
const char* PUBLIC_KEY_FILE = "/public_key.pem";
const char* CERTIFICATE_FILE = "/device_cert.pem";
const char* CA_CERT_FILE = "/ca_cert.pem";

// Timing Constants
const unsigned long UNLOCK_DURATION = 3000;
const unsigned long LOGIN_TIMEOUT = 10000;
const unsigned long UNLOCK_COOLDOWN = 5000;
const unsigned long HEARTBEAT_INTERVAL = 30000; 
const unsigned long CARD_DEBOUNCE_TIME = 3000;
const unsigned long fingerprintCheckInterval = 2000; 

// ========================================
// GLOBAL OBJECTS
// ========================================
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
HardwareSerial fingerSerial(1);
Adafruit_Fingerprint finger(&fingerSerial);
MFRC522 rfid(SS_PIN, RST_PIN);

// ========================================
// STATE VARIABLES
// ========================================

// Security
mbedtls_pk_context pk_ctx;
mbedtls_entropy_context entropy;
mbedtls_ctr_drbg_context ctr_drbg;
bool rsa_keys_ready = false;

mbedtls_x509_crt ca_cert;
bool ca_cert_loaded = false;

String device_challenge = "";
String device_certificate = "";

// Authentication
bool device_authenticated = false;
String session_token = "";
unsigned long last_heartbeat = 0;
bool login_request_sent = false;
unsigned long login_request_time = 0;

// Enrollment States
bool enrollingRFID = false;
String enrollingRFIDUserId = "";

bool enrollingFingerprint = false;
String enrollingFingerprintUserId = "";
int enrollingFingerprintId = -1;

bool deletingFingerprint = false;
String deletingFingerprintUserId = "";
int deletingFingerprintId = -1;

// Unlock State
enum UnlockState { IDLE, UNLOCKING, LOCKING };
UnlockState unlockState = IDLE;
bool isUnlocking = false;
unsigned long unlockStartTime = 0;
unsigned long lastUnlockTime = 0;

// RFID Debounce
String lastCardUID = "";
unsigned long lastCardTime = 0;

bool provisioning_completed = false; 
unsigned long provision_complete_time = 0;

// ========================================
// SECTION 1: WIFI & MQTT CONNECTION
// ========================================

void setupWiFi() {
  delay(10);
  Serial.println("\n=== WIFI CONNECTION ===");
  Serial.print("Connecting to: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);  
  WiFi.begin(ssid, password);

  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED && attempt < 40) {
    delay(500);
    Serial.print(".");
    attempt++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected");
    Serial.print("  IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n✗ WiFi connection failed");
    Serial.println("Restarting ESP32...");
    delay(5000);
    ESP.restart();
  }
}

bool setupSimpleTLS() {
  espClient.setInsecure();
  return true;
}

// --- MQTT Reconnect ---
void mqttReconnect() {
  while (!mqttClient.connected()) {
    // ✅ KIỂM TRA CERTIFICATE TRƯỚC KHI KẾT NỐI
    if (device_certificate.length() == 0) {
      Serial.println("\n✗ Device chưa có certificate!");
      Serial.println("Vui lòng đăng ký device trước");
      delay(5000);
      return;
    }

    // ✅ SETUP TLS 
    if (!setupSimpleTLS()) {
      Serial.println("✗ Không thể setup TLS!");
      delay(5000);
      return;
    }
    
    String clientId = "ESP32_SmartLock_";
    clientId += String(random(0xffff), HEX);
    
    if (mqttClient.connect(clientId.c_str(), mqtt_user, mqtt_password)) {
      Serial.println("\n=== MQTT CONNECTED ===");

      mqttClient.subscribe(topic_device_login_response);
      Serial.print("✓ Subscribed: ");
      Serial.println(topic_device_login_response);
      
      mqttClient.subscribe(topic_command);
      Serial.print("Da subscribe topic: ");
      Serial.println(topic_command);

      String enrollRFIDTopic = "smartlock/device/" + device_id + "/enroll/rfid";
      mqttClient.subscribe(enrollRFIDTopic.c_str());
      Serial.print("Da subscribe: ");
      Serial.println(enrollRFIDTopic);

      String enrollFingerprintTopic = "smartlock/device/" + device_id + "/enroll/fingerprint";
      mqttClient.subscribe(enrollFingerprintTopic.c_str());
      Serial.print("Da subscribe: ");
      Serial.println(enrollFingerprintTopic);

      String deleteFingerprintTopic = "smartlock/device/" + device_id + "/delete/fingerprint";
      mqttClient.subscribe(deleteFingerprintTopic.c_str());
      Serial.print("Da subscribe: ");
      Serial.println(deleteFingerprintTopic);

      String controlTopic = "smartlock/device/" + device_id + "/control";
      mqttClient.subscribe(controlTopic.c_str());
      Serial.print("Da subscribe: ");
      Serial.println(controlTopic);

      String unlockTopic = "smartlock/device/" + device_id + "/control/unlock";
      mqttClient.subscribe(unlockTopic.c_str());
      Serial.print("Da subscribe: ");
      Serial.println(unlockTopic);

      String deviceProvisionTopic = "smartlock/device/" + device_id + "/provision/token";
      mqttClient.subscribe(deviceProvisionTopic.c_str());
      Serial.print("Da subscribe: ");
      Serial.println(deviceProvisionTopic);

      mqttClient.subscribe(topic_device_provision_res);
      Serial.println("Da subscribe: smartlock/device/provision/response");
      
      mqttClient.subscribe(topic_device_finalize_res);
      Serial.println("Da subscribe: smartlock/device/finalize/response");

      String caCertTopic = "smartlock/device/" + device_id + "/ca_certificate";
      mqttClient.subscribe(caCertTopic.c_str());
      Serial.print("Da subscribe: ");
      Serial.println(caCertTopic);

      Serial.println("✓ Subscribed to all topics");
      
      mqttClient.publish(topic_status, "{\"status\":\"online\"}");

      // Wait for subscription
      delay(2000); 
      for (int i = 0; i < 5; i++) {
        mqttClient.loop();
        delay(100);
      }
      
      // GỬI LOGIN REQUEST 
      Serial.println("\n🔐 Đang gửi login request...");
      sendDeviceLogin();
      login_request_sent = true;
      login_request_time = millis();
    } else {
      Serial.print("that bai, rc=");
      Serial.print(mqttClient.state());
      delay(5000);
    }
  }
}

// ========================================
// SECTION 2: SECURITY & AUTHENTICATION
// ========================================

bool initSPIFFS() {
  if (!SPIFFS.begin(true)) {
    Serial.println("✗ Lỗi mount SPIFFS!");
    return false;
  }
  Serial.println("✓ SPIFFS mounted");
  return true;
}

void initMbedTLS() {
  mbedtls_pk_init(&pk_ctx);
  mbedtls_entropy_init(&entropy);
  mbedtls_ctr_drbg_init(&ctr_drbg);
  
  const char *pers = "esp32_smartlock";
  int ret = mbedtls_ctr_drbg_seed(&ctr_drbg, mbedtls_entropy_func, &entropy,
                                   (const unsigned char *)pers, strlen(pers));
  
  if (ret != 0) {
    Serial.printf("✗ Lỗi seed random: -0x%04x\n", -ret);
    return;
  }
  
  Serial.println("✓ mbedTLS initialized");
}

bool generateRSAKeyPair() {
  Serial.println("🔐 Đang tạo RSA keypair (2048-bit)...");
  Serial.println("⏳ Quá trình này mất ~30-45 giây...");
  
  unsigned long startTime = millis();
  
  int ret = mbedtls_pk_setup(&pk_ctx, mbedtls_pk_info_from_type(MBEDTLS_PK_RSA));
  if (ret != 0) {
    Serial.printf("✗ Lỗi setup PK: -0x%04x\n", -ret);
    return false;
  }
  
  ret = mbedtls_rsa_gen_key(mbedtls_pk_rsa(pk_ctx), 
                            mbedtls_ctr_drbg_random, 
                            &ctr_drbg,
                            2048,
                            65537);
  
  if (ret != 0) {
    Serial.printf("✗ Lỗi generate key: -0x%04x\n", -ret);
    return false;
  }
  
  unsigned long elapsed = millis() - startTime;
  Serial.printf("✓ Keypair generated trong %lu ms (%.1f giây)\n", elapsed, elapsed/1000.0);
  
  return true;
}

bool savePrivateKey() {
  unsigned char key_buf[4096];
  memset(key_buf, 0, sizeof(key_buf));
  
  int ret = mbedtls_pk_write_key_pem(&pk_ctx, key_buf, sizeof(key_buf));
  
  if (ret != 0) {
    Serial.printf("✗ Lỗi write private key: -0x%04x\n", -ret);
    return false;
  }
  
  File file = SPIFFS.open(PRIVATE_KEY_FILE, FILE_WRITE);
  if (!file) {
    Serial.println("✗ Không thể mở file private key");
    return false;
  }
  
  file.write(key_buf, strlen((char*)key_buf));
  file.close();
  
  Serial.println("✓ Private key đã lưu");
  return true;
}

bool savePublicKey() {
  unsigned char key_buf[2048];
  memset(key_buf, 0, sizeof(key_buf));
  
  int ret = mbedtls_pk_write_pubkey_pem(&pk_ctx, key_buf, sizeof(key_buf));
  
  if (ret != 0) {
    Serial.printf("✗ Lỗi write public key: -0x%04x\n", -ret);
    return false;
  }
  
  File file = SPIFFS.open(PUBLIC_KEY_FILE, FILE_WRITE);
  if (!file) {
    Serial.println("✗ Không thể mở file public key");
    return false;
  }
  
  file.write(key_buf, strlen((char*)key_buf));
  file.close();
  
  Serial.println("✓ Public key đã lưu");
  return true;
}

bool loadPrivateKey() {
  if (!SPIFFS.exists(PRIVATE_KEY_FILE)) {
    Serial.println("⚠️ Private key chưa tồn tại");
    return false;
  }
  
  File file = SPIFFS.open(PRIVATE_KEY_FILE, FILE_READ);
  if (!file) {
    Serial.println("✗ Không thể đọc private key");
    return false;
  }
  
  size_t size = file.size();
  uint8_t *buf = (uint8_t*)malloc(size + 1);
  if (!buf) {
    Serial.println("✗ Không đủ RAM để load private key");
    file.close();
    return false;
  }
  
  file.read(buf, size);
  buf[size] = 0;
  file.close();
  
  int ret = mbedtls_pk_parse_key(&pk_ctx, buf, size + 1, NULL, 0,
                                  mbedtls_ctr_drbg_random, &ctr_drbg);
  free(buf);
  
  if (ret != 0) {
    Serial.printf("✗ Lỗi parse private key: -0x%04x\n", -ret);
    return false;
  }
  
  Serial.println("✓ Private key loaded");
  return true;
}

String loadPublicKey() {
  if (!SPIFFS.exists(PUBLIC_KEY_FILE)) {
    Serial.println("⚠️ Public key chưa tồn tại");
    return "";
  }
  
  File file = SPIFFS.open(PUBLIC_KEY_FILE, FILE_READ);
  if (!file) {
    Serial.println("✗ Không thể đọc public key");
    return "";
  }
  
  String pubKey = file.readString();
  file.close();
  
  return pubKey;
}

bool initRSAKeys() {
  Serial.println("\n=== KHỞI TẠO RSA KEYS ===");
  
  if (!initSPIFFS()) {
    return false;
  }
  
  initMbedTLS();
  
  // Kiểm tra đã có keys chưa
  if (SPIFFS.exists(PRIVATE_KEY_FILE) && SPIFFS.exists(PUBLIC_KEY_FILE)) {
    Serial.println("✓ Keys đã tồn tại, đang load...");
    
    if (loadPrivateKey()) {
      rsa_keys_ready = true;
      Serial.println("✓ RSA keys sẵn sàng!");
      return true;
    } else {
      Serial.println("⚠️ Load keys thất bại, sẽ xóa và tạo mới...");
      SPIFFS.remove(PRIVATE_KEY_FILE);
      SPIFFS.remove(PUBLIC_KEY_FILE);
    }
  }
  
  if (!generateRSAKeyPair()) {
    Serial.println("✗ Tạo keypair thất bại!");
    return false;
  }
  
  if (!savePrivateKey() || !savePublicKey()) {
    Serial.println("✗ Lưu keys thất bại!");
    return false;
  }
  
  rsa_keys_ready = true;
  Serial.println("✓ RSA keys đã tạo và lưu thành công!");
  
  return true;
}

String generatePublicKey() {
  if (!rsa_keys_ready) {
    Serial.println("✗ RSA keys chưa sẵn sàng!");
    return "";
  }
  
  String pubKey = loadPublicKey();
  
  if (pubKey.length() == 0) {
    Serial.println("✗ Không thể load public key!");
    return "";
  }
  
  Serial.println("✓ Public key loaded:");
  Serial.println(pubKey.substring(0, 80) + "...");
  
  return pubKey;
}

String signChallenge(String challenge) {
  if (!rsa_keys_ready) {
    Serial.println("✗ RSA keys chưa sẵn sàng!");
    return "";
  }
  
  Serial.println("🔐 Đang ký challenge với RSA private key...");
  Serial.print("Challenge: ");
  Serial.println(challenge);
  
  // 1. Hash challenge bằng SHA256
  unsigned char hash[32];
  mbedtls_md_context_t md_ctx;
  mbedtls_md_init(&md_ctx);
  
  const mbedtls_md_info_t *md_info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!md_info) {
    Serial.println("✗ Không tìm thấy SHA256 algorithm");
    mbedtls_md_free(&md_ctx);
    return "";
  }
  
  int ret = mbedtls_md_setup(&md_ctx, md_info, 0);
  if (ret != 0) {
    Serial.printf("✗ Lỗi setup MD: -0x%04x\n", -ret);
    mbedtls_md_free(&md_ctx);
    return "";
  }
  
  ret = mbedtls_md_starts(&md_ctx);
  if (ret != 0) {
    Serial.printf("✗ Lỗi MD starts: -0x%04x\n", -ret);
    mbedtls_md_free(&md_ctx);
    return "";
  }
  
  ret = mbedtls_md_update(&md_ctx, (const unsigned char*)challenge.c_str(), challenge.length());
  if (ret != 0) {
    Serial.printf("✗ Lỗi MD update: -0x%04x\n", -ret);
    mbedtls_md_free(&md_ctx);
    return "";
  }
  
  ret = mbedtls_md_finish(&md_ctx, hash);
  mbedtls_md_free(&md_ctx);
  
  if (ret != 0) {
    Serial.printf("✗ Lỗi MD finish: -0x%04x\n", -ret);
    return "";
  }
  
  Serial.println("✓ Challenge đã hash (SHA256)");
  
  // Debug: In ra hash
  Serial.print("Hash (hex): ");
  for(int i = 0; i < 32; i++) {
    Serial.printf("%02x", hash[i]);
  }
  Serial.println();
  
  // 2. Ký hash bằng RSA private key
  unsigned char signature[256]; // RSA 2048-bit = 256 bytes signature
  size_t sig_len = 0;
  
  ret = mbedtls_pk_sign(&pk_ctx, 
                        MBEDTLS_MD_SHA256,
                        hash, 
                        32,
                        signature,
                        sizeof(signature),  
                        &sig_len,
                        mbedtls_ctr_drbg_random, 
                        &ctr_drbg);
  
  if (ret != 0) {
    Serial.printf("✗ Lỗi sign: -0x%04x\n", -ret);
    return "";
  }
  
  // 3. Encode signature thành base64
  unsigned char base64_buf[512];
  size_t base64_len = 0;
  
  ret = mbedtls_base64_encode(base64_buf, sizeof(base64_buf), &base64_len,
                               signature, sig_len);
  
  if (ret == MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL) {
    Serial.println("✗ Base64 buffer quá nhỏ!");
    return "";
  } else if (ret != 0) {
    Serial.printf("✗ Lỗi base64 encode: -0x%04x\n", -ret);
    return "";
  }
  
  String signedChallenge = String((char*)base64_buf);
  return signedChallenge;
}

bool initCACertificate() {
  Serial.println("🔐 KHỞI TẠO CA CERTIFICATE");
  
  mbedtls_x509_crt_init(&ca_cert);
  
  // Kiểm tra file CA cert đã tồn tại chưa
  if (!SPIFFS.exists(CA_CERT_FILE)) {
    Serial.println("⚠️ CA Certificate chưa tồn tại");
    Serial.println("Cần yêu cầu CA cert từ server");
    return false;
  }
  
  // Đọc CA certificate từ file
  File file = SPIFFS.open(CA_CERT_FILE, FILE_READ);
  if (!file) {
    Serial.println("✗ Không thể đọc CA certificate");
    return false;
  }
  
  size_t size = file.size();
  uint8_t *buf = (uint8_t*)malloc(size + 1);
  if (!buf) {
    Serial.println("✗ Không đủ RAM để load CA cert");
    file.close();
    return false;
  }
  
  file.read(buf, size);
  buf[size] = 0;
  file.close();
  
  // Parse CA certificate
  int ret = mbedtls_x509_crt_parse(&ca_cert, buf, size + 1);
  free(buf);
  
  if (ret != 0) {
    Serial.printf("✗ Lỗi parse CA certificate: -0x%04x\n", -ret);
    return false;
  }
  
  ca_cert_loaded = true;
  
  // In thông tin CA certificate
  Serial.println("✓ CA Certificate loaded thành công!");
  Serial.println("\n--- THÔNG TIN CA CERTIFICATE ---");
  
  char subject_buf[256];
  mbedtls_x509_dn_gets(subject_buf, sizeof(subject_buf), &ca_cert.subject);
  Serial.print("Subject: ");
  Serial.println(subject_buf);
  
  char issuer_buf[256];
  mbedtls_x509_dn_gets(issuer_buf, sizeof(issuer_buf), &ca_cert.issuer);
  Serial.print("Issuer: ");
  Serial.println(issuer_buf);
  
  // In validity
  char not_before[32], not_after[32];
  snprintf(not_before, sizeof(not_before), "%04d-%02d-%02d %02d:%02d:%02d",
           ca_cert.valid_from.year, ca_cert.valid_from.mon, ca_cert.valid_from.day,
           ca_cert.valid_from.hour, ca_cert.valid_from.min, ca_cert.valid_from.sec);
  snprintf(not_after, sizeof(not_after), "%04d-%02d-%02d %02d:%02d:%02d",
           ca_cert.valid_to.year, ca_cert.valid_to.mon, ca_cert.valid_to.day,
           ca_cert.valid_to.hour, ca_cert.valid_to.min, ca_cert.valid_to.sec);
  
  Serial.print("Valid From: ");
  Serial.println(not_before);
  Serial.print("Valid To: ");
  Serial.println(not_after);
  
  Serial.println("=================================\n");
  
  return true;
}

bool saveCACertificate(String caCertPem) {
  Serial.println("💾 Đang lưu CA certificate...");

  caCertPem.replace("\\r\\n", "\n");
  caCertPem.replace("\\n", "\n");
  
  File file = SPIFFS.open(CA_CERT_FILE, FILE_WRITE);
  if (!file) {
    Serial.println("✗ Không thể mở file CA cert để ghi");
    return false;
  }
  
  file.print(caCertPem);
  file.close();
  
  Serial.println("✓ CA certificate đã lưu vào SPIFFS");
  
  return initCACertificate();
}

bool verifyDeviceCertificate(String deviceCertPem) {
  Serial.println("🔍 VERIFY DEVICE CERTIFICATE");
  
  if (!ca_cert_loaded) {
    Serial.println("✗ CA Certificate chưa được load!");
    Serial.println("Không thể verify device certificate");
    return false;
  }
  
  // Parse device certificate
  mbedtls_x509_crt device_cert;
  mbedtls_x509_crt_init(&device_cert);
  
  int ret = mbedtls_x509_crt_parse(&device_cert, 
                                   (const unsigned char*)deviceCertPem.c_str(), 
                                   deviceCertPem.length() + 1);
  
  if (ret != 0) {
    Serial.printf("✗ Lỗi parse device certificate: -0x%04x\n", -ret);
    mbedtls_x509_crt_free(&device_cert);
    return false;
  }
  
  Serial.println("✓ Device certificate parsed");
  
  // In thông tin device certificate
  Serial.println("\n--- THÔNG TIN DEVICE CERTIFICATE ---");
  
  char subject_buf[256];
  mbedtls_x509_dn_gets(subject_buf, sizeof(subject_buf), &device_cert.subject);
  Serial.print("Subject: ");
  Serial.println(subject_buf);
  
  char issuer_buf[256];
  mbedtls_x509_dn_gets(issuer_buf, sizeof(issuer_buf), &device_cert.issuer);
  Serial.print("Issuer: ");
  Serial.println(issuer_buf);
  
  // Serial number
  char serial_buf[128];
  mbedtls_x509_serial_gets(serial_buf, sizeof(serial_buf), &device_cert.serial);
  Serial.print("Serial Number: ");
  Serial.println(serial_buf);
  
  // Validity
  char not_before[32], not_after[32];
  snprintf(not_before, sizeof(not_before), "%04d-%02d-%02d %02d:%02d:%02d",
           device_cert.valid_from.year, device_cert.valid_from.mon, device_cert.valid_from.day,
           device_cert.valid_from.hour, device_cert.valid_from.min, device_cert.valid_from.sec);
  snprintf(not_after, sizeof(not_after), "%04d-%02d-%02d %02d:%02d:%02d",
           device_cert.valid_to.year, device_cert.valid_to.mon, device_cert.valid_to.day,
           device_cert.valid_to.hour, device_cert.valid_to.min, device_cert.valid_to.sec);
  
  Serial.print("Valid From: ");
  Serial.println(not_before);
  Serial.print("Valid To: ");
  Serial.println(not_after);
  
  Serial.println("\n--- BẮT ĐẦU VERIFY ---");
  
  // Verify certificate chain
  uint32_t flags;
  ret = mbedtls_x509_crt_verify(&device_cert, 
                                &ca_cert, 
                                NULL, 
                                NULL,  
                                &flags,
                                NULL, 
                                NULL); 
  
  if (ret != 0) {
    Serial.printf("✗ Verify thất bại! Error code: -0x%04x\n", -ret);
    
    // In chi tiết lỗi
    char vrfy_buf[512];
    mbedtls_x509_crt_verify_info(vrfy_buf, sizeof(vrfy_buf), "  ! ", flags);
    Serial.println("Chi tiết lỗi:");
    Serial.println(vrfy_buf);
    
    mbedtls_x509_crt_free(&device_cert);
    return false;
  }
  
  Serial.println("✓ VERIFY THÀNH CÔNG!");
  Serial.println("   - Certificate signature hợp lệ");
  Serial.println("   - Được ký bởi CA trust");
  Serial.println("   - Certificate còn hiệu lực");
  Serial.println("=================================\n");
  
  mbedtls_x509_crt_free(&device_cert);
  return true;
}

void sendDeviceLogin() {
  Serial.println("🔐 ĐĂNG NHẬP THIẾT BỊ VÀO HỆ THỐNG");

  if (!mqttClient.connected()) {
    Serial.println("✗ MQTT chưa kết nối!");
    return;
  }

  // ✅ THÊM: Kiểm tra đã login chưa
  if (device_authenticated && session_token.length() > 0) {
    Serial.println("⚠️ Device đã login rồi - Bỏ qua");
    Serial.println("   Current token: " + session_token.substring(0, 16) + "...");
    return;
  }

  // ✅ THÊM: Kiểm tra cooldown (tránh spam login)
  static unsigned long last_login_attempt = 0;
  if (millis() - last_login_attempt < 3000) {
    Serial.println("⚠️ Login cooldown - Chờ 3s");
    return;
  }
  last_login_attempt = millis();

  // Tạo timestamp
  unsigned long timestamp = millis();
  
  // Tạo challenge từ timestamp
  String challenge = String(timestamp);
  
  // Ký challenge bằng private key
  String signature = signChallenge(challenge);
  
  if (signature.length() == 0) {
    Serial.println("✗ Không thể tạo signature!");
    return;
  }

  // Tạo payload
  String payload = "{";
  payload += "\"device_id\":\"" + device_id + "\",";
  payload += "\"timestamp\":" + String(timestamp) + ",";
  payload += "\"signature\":\"" + signature + "\"";
  payload += "}";

  Serial.println("📤 Gửi yêu cầu đăng nhập...");
  Serial.println("Device ID: " + device_id);
  Serial.println("Timestamp: " + String(timestamp));
  
  bool published = mqttClient.publish(topic_device_login, payload.c_str());
  
  if (published) {
    Serial.println("✓ Đã gửi login request");
  } else {
    Serial.println("✗ Gửi login request thất bại!");
  }
}

void parseDeviceLoginResponse(String jsonString) {
  Serial.println("📥 NHẬN LOGIN RESPONSE");
  Serial.println("Raw JSON:");
  Serial.println(jsonString);

  // ✅ THÊM: Kiểm tra đã login chưa
  if (device_authenticated && session_token.length() > 0) {
    Serial.println("⚠️ Device đã login rồi - Bỏ qua response này");
    Serial.println("   Current token: " + session_token.substring(0, 16) + "...");
    return;
  }

  // Parse success
  bool success = jsonString.indexOf("\"success\":true") > 0;
  
  if (success) {
    // Parse session_token
    int tokenStart = jsonString.indexOf("\"session_token\":\"") + 17;
    int tokenEnd = jsonString.indexOf("\"", tokenStart);
    
    if (tokenStart > 16 && tokenEnd > tokenStart) {
      session_token = jsonString.substring(tokenStart, tokenEnd);
      device_authenticated = true;
      login_request_sent = false; 
      last_heartbeat = millis();
      
      Serial.println("✅ ĐĂNG NHẬP THÀNH CÔNG!");
      Serial.println("Session token: " + session_token.substring(0, 16) + "...");
      Serial.println("=================================\n");
      
      // Bắt đầu gửi heartbeat
      sendHeartbeat();
      
    } else {
      Serial.println("✗ Không parse được session_token");
      Serial.println("tokenStart: " + String(tokenStart));
      Serial.println("tokenEnd: " + String(tokenEnd));
    }
  } else {
    Serial.println("❌ ĐĂNG NHẬP THẤT BẠI!");
    
    // Parse reason
    int reasonStart = jsonString.indexOf("\"reason\":\"") + 10;
    int reasonEnd = jsonString.indexOf("\"", reasonStart);
    
    if (reasonStart > 9 && reasonEnd > reasonStart) {
      String reason = jsonString.substring(reasonStart, reasonEnd);
      Serial.println("Lý do: " + reason);
    }
    
    Serial.println("=================================\n");
    
    device_authenticated = false;
    session_token = "";
    login_request_sent = false; 
  }
}

void sendHeartbeat() {
  if (!device_authenticated || session_token.length() == 0) {
    return;
  }

  String payload = "{";
  payload += "\"device_id\":\"" + device_id + "\",";
  payload += "\"session_token\":\"" + session_token + "\",";
  payload += "\"status\":\"online\",";
  payload += "\"timestamp\":" + String(millis());
  payload += "}";

  mqttClient.publish(topic_device_heartbeat, payload.c_str());
  
  Serial.println("💓 Heartbeat sent");
  last_heartbeat = millis();
}

void requestCACertificate() {
  Serial.println("📤 Yêu cầu CA Certificate từ server...");
  
  String topic = "smartlock/device/" + device_id + "/request_ca_cert";
  String payload = "{\"device_id\":\"" + device_id + "\"}";
  
  mqttClient.publish(topic.c_str(), payload.c_str());
  Serial.println("✓ Đã gửi request CA cert");
}

// ========================================
// SECTION 3: DEVICE PROVISIONING
// ========================================

void sendProvisionRequest(String provisioningToken) {
  Serial.println("📤 Gửi provision request...");

  // ✅ Lấy public key thật từ RSA keypair
  String publicKey = generatePublicKey();
  
  if (publicKey.length() == 0) {
    Serial.println("✗ Không thể lấy public key!");
    return;
  }
  
  // Escape newlines
  publicKey.replace("\n", "\\n");
  
  String payload = "{\"device_id\":\"" + device_id + 
                   "\",\"provisioning_token\":\"" + provisioningToken + 
                   "\",\"public_key_pem\":\"" + publicKey + "\"}";

  Serial.println("📋 Payload size: " + String(payload.length()) + " bytes");
  Serial.println("📋 MQTT buffer size: " + String(mqttClient.getBufferSize()) + " bytes");
  
  if (payload.length() > mqttClient.getBufferSize()) {
    Serial.println("✗ LỖI: Payload lớn hơn buffer size!");
    return;
  }
  
  bool published = mqttClient.publish(topic_device_provision_req, payload.c_str());
  
  if (published) {
    Serial.println("✓ Đã gửi provision request thành công");
  } else {
    Serial.println("✗ LỖI: Không thể publish provision request!");
  }
}

void sendFinalizeRequest(String signedChallenge) {
  Serial.println("📤 Gửi finalize request...");

  String payload = "{\"device_id\":\"" + device_id + 
                   "\",\"signed_challenge\":\"" + signedChallenge + "\"}";

  bool published = mqttClient.publish(topic_device_finalize_req, payload.c_str());
  
  if (published) {
    Serial.println("✓ Đã gửi finalize request");
  } else {
    Serial.println("✗ Không thể publish finalize!");
  }
}

void parseProvisionToken(String jsonString) {
  Serial.println("🔐 BẮT ĐẦU ĐĂNG KÝ THIẾT BỊ TỰ ĐỘNG");
  
  // Parse device_id (kiểm tra có đúng thiết bị này không)
  int deviceIdStart = jsonString.indexOf("\"device_id\":\"") + 13;
  int deviceIdEnd = jsonString.indexOf("\"", deviceIdStart);
  String receivedDeviceId = jsonString.substring(deviceIdStart, deviceIdEnd);
  
  if (receivedDeviceId != device_id) {
    Serial.println("✗ Token không dành cho thiết bị này!");
    Serial.println("Device ID nhận được: " + receivedDeviceId);
    Serial.println("Device ID của mình: " + device_id);
    return;
  }
  
  // Parse provisioning_token
  int tokenStart = jsonString.indexOf("\"provisioning_token\":\"") + 22;
  int tokenEnd = jsonString.indexOf("\"", tokenStart);
  String provisioningToken = jsonString.substring(tokenStart, tokenEnd);
  
  if (provisioningToken.length() == 0) {
    Serial.println("✗ Lỗi parse token!");
    return;
  }
  
  Serial.println("✓ Token đã nhận: " + provisioningToken.substring(0, 10) + "...");
  
  delay(1000); 
  sendProvisionRequest(provisioningToken);
}

void parseProvisionResponse(String jsonString) {
  int challengeStart = jsonString.indexOf("\"challenge\":\"") + 13;
  int challengeEnd = jsonString.indexOf("\"", challengeStart);
  
  if (challengeStart > 12 && challengeEnd > challengeStart) {
    device_challenge = jsonString.substring(challengeStart, challengeEnd);
    Serial.println("✓ Challenge: " + device_challenge);
    
    if (jsonString.indexOf("\"success\":true") > 0) {
      Serial.println("✓ Provision thành công!");
      
      String signedChallenge = signChallenge(device_challenge);
      
      if (signedChallenge.length() > 0) {
        sendFinalizeRequest(signedChallenge);
      } else {
        Serial.println("✗ Không thể ký challenge!");
      }
    } else {
      Serial.println("✗ Provision thất bại!");
    }
  } else {
    Serial.println("✗ Lỗi parse challenge");
  }
}

void parseFinalizeResponse(String jsonString) {
  if (jsonString.indexOf("\"success\":true") > 0) {
    Serial.println("✓ Finalize thành công!");
    
    int certStart = jsonString.indexOf("\"certificate\":\"") + 15;
    int certEnd = jsonString.lastIndexOf("\"");
    
    if (certStart > 14 && certEnd > certStart) {
      device_certificate = jsonString.substring(certStart, certEnd);

      device_certificate.replace("\\r\\n", "\n");
      device_certificate.replace("\\n", "\n");
      
      // ✅ VERIFY CERTIFICATE TRƯỚC KHI LƯU
      if (ca_cert_loaded) {
        if (verifyDeviceCertificate(device_certificate)) {
          Serial.println("✅ Certificate đã được verify thành công!");
          
          // Lưu certificate vào SPIFFS
          File file = SPIFFS.open(CERTIFICATE_FILE, FILE_WRITE);
          if (file) {
            file.print(device_certificate);
            file.close();
            Serial.println("✓ Certificate đã lưu vào SPIFFS");
          }
          
          Serial.println("\n✅ ĐĂNG KÝ THIẾT BỊ HOÀN TẤT!");

          // ✅ MỚI: Set flag provision completed
          provisioning_completed = true;
          provision_complete_time = millis();

           Serial.println("\n⚠️ SẼ RECONNECT MQTT SAU 3 GIÂY...");
        } else {
          Serial.println("✗ Certificate verification thất bại!");
        }
      } else {
        Serial.println("⚠️ CA cert chưa load");
        
        // Lưu certificate vào SPIFFS
        File file = SPIFFS.open(CERTIFICATE_FILE, FILE_WRITE);
        if (file) {
          file.print(device_certificate);
          file.close();
          Serial.println("✓ Certificate đã lưu vào SPIFFS (chưa verify)");
        }

        // ✅ THÊM: Request CA cert để verify
        Serial.println("📤 Đang yêu cầu CA Certificate từ server...");
        delay(500);
        requestCACertificate();
        
        Serial.println("⏳ Chờ nhận CA cert...");
        unsigned long startWait = millis();
        while (!ca_cert_loaded && (millis() - startWait < 5000)) {
          mqttClient.loop(); 
          delay(100);
        }
      }
    }
  } else {
    Serial.println("✗ Finalize thất bại!");
    int reasonStart = jsonString.indexOf("\"reason\":\"") + 10;
    int reasonEnd = jsonString.indexOf("\"", reasonStart);
    if (reasonStart > 9 && reasonEnd > reasonStart) {
      String reason = jsonString.substring(reasonStart, reasonEnd);
      Serial.println("Lý do: " + reason);
    }
  }
}

// ========================================
// SECTION 4: HARDWARE CONTROL
// ========================================

void unlockDoor() {
  if (isUnlocking) {
    return;
  }
  
  if (millis() - lastUnlockTime < UNLOCK_COOLDOWN) {
    return;
  }

  Serial.println("🔓 ĐANG MỞ KHÓA...");

  isUnlocking = true;
  lastUnlockTime = millis();
  unlockStartTime = millis();
  unlockState = UNLOCKING;
  
  digitalWrite(RELAY_PIN, HIGH);
  
  bool published = mqttClient.publish(topic_status, "{\"status\":\"unlocked\"}");
  
  if (published) {
    Serial.println("✓ Đã gửi trạng thái lên server");
  } else {
    Serial.println("⚠️ Không gửi được trạng thái lên server");
  }
  
  Serial.println("⏳ Chờ 3 giây tự động khóa lại...");
}

void resetRFIDDebounce() { 
  lastCardUID = "";
  lastCardTime = 0;
  rfid.PCD_Init();
}

int getFingerprintID() {
  uint8_t p = finger.getImage();
  
  if (p == FINGERPRINT_NOFINGER) {
    return -1; // Không có ngón tay
  } 
  
  if (p != FINGERPRINT_OK) {
    Serial.print("⚠️ Lỗi getImage: "); 
    Serial.println(p);
    return -1;
  }

  // Có ngón tay → Convert
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.print("⚠️ Lỗi image2Tz: "); 
    Serial.println(p);
    return -1;
  }

  p = finger.fingerFastSearch();
  
  if (p == FINGERPRINT_OK) {
    return finger.fingerID;
    
  } else if (p == FINGERPRINT_NOTFOUND) {
    return -2;
    
  } else {
    Serial.print("⚠️ Lỗi fingerFastSearch: "); 
    Serial.println(p);
    return -1;
  }
}

// ========================================
// SECTION 5: FINGERPRINT MANAGEMENT
// ========================================

void enrollFingerprintRemote(uint8_t id, String userId) {
  int p = -1;
  
  Serial.println("=== BAT DAU DANG KY VAN TAY TU XA ===");
  Serial.print("ID: ");
  Serial.println(id);
  
  // Bước 1: Lấy hình ảnh lần 1
  Serial.println("Buoc 1: Dat ngon tay vao cam bien...");
  unsigned long startTime = millis();
  while (p != FINGERPRINT_OK) {
    if (millis() - startTime > 15000) {
      Serial.println("-> TIMEOUT: Khong phat hien ngon tay!");
      sendEnrollResult(false, id, userId, "Timeout - khong phat hien ngon tay");
      enrollingFingerprint = false;
      return;
    }
    
    p = finger.getImage();
    if (p == FINGERPRINT_NOFINGER) {
      continue;
    } else if (p == FINGERPRINT_OK) {
      Serial.println("-> Da phat hien ngon tay!");
      break;
    } else {
      Serial.print("-> Loi getImage (1): ");
      Serial.println(p);
      sendEnrollResult(false, id, userId, "Loi doc hinh anh lan 1");
      enrollingFingerprint = false;
      return;
    }
    delay(100);
  }
  
  // Chuyển đổi hình ảnh thành template 1
  p = finger.image2Tz(1);
  if (p == FINGERPRINT_OK) {
    Serial.println("-> Chuyen doi hinh anh 1 thanh cong!");
  } else {
    Serial.print("-> Loi image2Tz(1): ");
    Serial.println(p);
    sendEnrollResult(false, id, userId, "Loi chuyen doi hinh anh 1");
    enrollingFingerprint = false;
    return;
  }
  
  Serial.println("\nBuoc 2: NHAN NGON TAY RA, doi 2 giay...");
  delay(2000);
  
  // Đợi ngón tay được nhấc ra
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
    delay(100);
  }
  Serial.println("-> Da nhan ngon tay ra!");
  
  // Bước 2: Lấy hình ảnh lần 2
  Serial.println("\nBuoc 3: Dat LAI CUNG NGON TAY vao cam bien lan 2...");
  p = -1;
  startTime = millis();
  while (p != FINGERPRINT_OK) {
    if (millis() - startTime > 15000) {
      Serial.println("-> TIMEOUT: Khong phat hien ngon tay lan 2!");
      sendEnrollResult(false, id, userId, "Timeout - khong phat hien ngon tay lan 2");
      enrollingFingerprint = false;
      return;
    }
    
    p = finger.getImage();
    if (p == FINGERPRINT_NOFINGER) {
      continue;
    } else if (p == FINGERPRINT_OK) {
      Serial.println("-> Da phat hien ngon tay lan 2!");
      break;
    } else {
      Serial.print("-> Loi getImage (2): ");
      Serial.println(p);
      sendEnrollResult(false, id, userId, "Loi doc hinh anh lan 2");
      enrollingFingerprint = false;
      return;
    }
    delay(100);
  }
  
  // Chuyển đổi hình ảnh thành template 2
  p = finger.image2Tz(2);
  if (p == FINGERPRINT_OK) {
    Serial.println("-> Chuyen doi hinh anh 2 thanh cong!");
  } else {
    Serial.print("-> Loi image2Tz(2): ");
    Serial.println(p);
    sendEnrollResult(false, id, userId, "Loi chuyen doi hinh anh 2");
    enrollingFingerprint = false;
    return;
  }
  
  // Bước 3: Tạo model từ 2 template
  Serial.println("\nBuoc 4: Tao model tu 2 template...");
  p = finger.createModel();
  if (p == FINGERPRINT_OK) {
    Serial.println("-> Tao model thanh cong!");
  } else if (p == FINGERPRINT_ENROLLMISMATCH) {
    Serial.println("-> LOI: Hai lan quet khong khop nhau!");
    sendEnrollResult(false, id, userId, "Hai lan quet khong khop nhau");
    enrollingFingerprint = false;
    return;
  } else {
    Serial.print("-> Loi createModel: ");
    Serial.println(p);
    sendEnrollResult(false, id, userId, "Loi tao model");
    enrollingFingerprint = false;
    return;
  }
  
  // Bước 4: Lưu model vào database của cảm biến
  Serial.print("\nBuoc 5: Luu model vao ID ");
  Serial.print(id);
  Serial.println("...");
  p = finger.storeModel(id);
  if (p == FINGERPRINT_OK) {
    Serial.println("-> LUU VAN TAY THANH CONG!");
    Serial.print("   ID: ");
    Serial.println(id);
    Serial.println("=================================\n");
    
    // Gửi kết quả thành công lên server
    sendEnrollResult(true, id, userId, "");
    enrollingFingerprint = false;
  } else {
    Serial.print("-> Loi storeModel: ");
    Serial.println(p);
    sendEnrollResult(false, id, userId, "Loi luu vao cam bien");
    enrollingFingerprint = false;
  }
}

void sendEnrollResult(bool success, int fingerprintId, String userId, String reason) {
  String msg = "{\"status\":\"" + String(success ? "success" : "failed") + 
              "\",\"fingerprintId\":" + String(fingerprintId) +
              ",\"userId\":\"" + userId + "\"" +
              ",\"device_id\":\"" + device_id + "\""; 
  
  if (!success && reason.length() > 0) {
    msg += ",\"reason\":\"" + reason + "\"";
  }
  
  msg += "}";
  
  mqttClient.publish(topic_enroll_fingerprint_result, msg.c_str());
}

void sendDeleteResult(bool success, int fingerprintId, String userId, String reason) {
  String msg = "{\"status\":\"" + String(success ? "success" : "failed") + 
               "\",\"fingerprintId\":" + String(fingerprintId) +
               ",\"userId\":\"" + userId + "\"" +
               ",\"device_id\":\"" + device_id + "\""; 
  
  if (!success && reason.length() > 0) {
    msg += ",\"reason\":\"" + reason + "\"";
  }
  
  msg += "}";
  
  mqttClient.publish(topic_delete_fingerprint_result, msg.c_str());
  Serial.println("Da gui ket qua xoa len server:");
  Serial.println(msg);
}

void deleteFingerprintRemote(uint8_t id, String userId) {
  Serial.print("Dang xoa van tay ID: ");
  Serial.println(id);
  
  uint8_t p = finger.deleteModel(id);
  
  if (p == FINGERPRINT_OK) {
    Serial.println("-> XOA THANH CONG!");
    
    // Gửi kết quả thành công lên server
    sendDeleteResult(true, id, userId, "");
    
  } else {
    Serial.print("-> Loi xoa van tay: ");
    Serial.println(p);
    
    // Gửi kết quả thất bại lên server
    String reason = "Loi xoa tu cam bien (code: " + String(p) + ")";
    sendDeleteResult(false, id, userId, reason);
  }
  
  // Reset trạng thái
  deletingFingerprint = false;
  deletingFingerprintUserId = "";
  deletingFingerprintId = -1;
}

// ========================================
// SECTION 6: MQTT CALLBACK
// ========================================

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Nhan tin nhan tu topic: ");
  Serial.println(topic);
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print("Noi dung: ");
  Serial.println(message);

  // ✅ XỬ LÝ LOGIN RESPONSE
  if (String(topic) == topic_device_login_response) {
    Serial.println("🔔 Nhận login response");
    
    // ✅ THÊM: Parse và kiểm tra device_id TRƯỚC
    int deviceIdStart = message.indexOf("\"device_id\":\"") + 13;
    int deviceIdEnd = message.indexOf("\"", deviceIdStart);
    
    if (deviceIdStart > 12 && deviceIdEnd > deviceIdStart) {
      String receivedDeviceId = message.substring(deviceIdStart, deviceIdEnd);
      
      // ✅ CHỈ XỬ LÝ NẾU LÀ LOGIN RESPONSE CHO DEVICE NÀY
      if (receivedDeviceId == device_id) {
        Serial.println("✓ Login response cho device này!");
        parseDeviceLoginResponse(message);
      } else {
        Serial.println("⏭️ Bỏ qua - Login response cho device khác: " + receivedDeviceId);
      }
    }
    
    return;
  }

  // ✅ XỬ LÝ NHẬN CA CERTIFICATE TỪ SERVER
  String caCertTopic = "smartlock/device/" + device_id + "/ca_certificate";
  if (String(topic) == caCertTopic) {
    Serial.println("📥 Nhận CA Certificate từ server");
    
    int certStart = message.indexOf("\"ca_certificate\":\"") + 18;
    int certEnd = message.lastIndexOf("\"");
    
    if (certStart > 17 && certEnd > certStart) {
      String caCertPem = message.substring(certStart, certEnd);

      caCertPem.replace("\\r\\n", "\n");
      caCertPem.replace("\\n", "\n");
      
      if (saveCACertificate(caCertPem)) {
        Serial.println("✅ CA Certificate đã lưu và load thành công!");
      }
    }
    return;
  }

  // ✅ XỬ LÝ NHẬN TOKEN 
  String deviceProvisionTopic = "smartlock/device/" + device_id + "/provision/token";
  if (String(topic) == deviceProvisionTopic) {
    Serial.println("📥 Nhận provisioning token TỪ TOPIC RIÊNG của thiết bị này");
    parseProvisionToken(message);
    return;
  }

  // ✅ XỬ LÝ PROVISION RESPONSE 
  if (String(topic) == topic_device_provision_res) {
    Serial.println("📥 Nhận provision response từ server");
    parseProvisionResponse(message); 
    return;
  }

  // ✅ XỬ LÝ FINALIZE RESPONSE 
  if (String(topic) == topic_device_finalize_res) {
    Serial.println("📥 Nhận finalize response từ server");
    parseFinalizeResponse(message); 
    return;
  }

    // Thêm topic disconnect
  String disconnectTopic = "smartlock/device/" + device_id + "/disconnect";
  if (String(topic) == disconnectTopic) {
    Serial.println("⚠️ NHẬN LỆNH DISCONNECT TỪ SERVER!");
    
    // Parse reason
    int reasonStart = message.indexOf("\"reason\":\"") + 10;
    int reasonEnd = message.indexOf("\"", reasonStart);
    if (reasonStart > 9 && reasonEnd > reasonStart) {
      String reason = message.substring(reasonStart, reasonEnd);
      Serial.println("Lý do: " + reason);
    }
    
    // Kiểm tra có yêu cầu clear credentials không
    if (message.indexOf("\"action\":\"clear_credentials\"") > 0) {
      Serial.println("🗑️ Đang xóa credentials...");
      clearDeviceCredentials();
    }
    
    // Disconnect MQTT
    device_authenticated = false;
    session_token = "";
    mqttClient.disconnect();
    
    Serial.println("✓ Đã disconnect khỏi server");
    return;
  }

  // ✅ XỬ LÝ TOPIC UNLOCK RIÊNG 
  String unlockTopic = "smartlock/device/" + device_id + "/control/unlock";
  if (String(topic) == unlockTopic) {
    if (millis() - lastUnlockTime < UNLOCK_COOLDOWN) {
      Serial.println("⚠️ Unlock cooldown - Bỏ qua lệnh");
      return;
    }
  
    if (isUnlocking) {
      Serial.println("⚠️ Đang unlock - Bỏ qua lệnh mới");
      return;
    }
  
    Serial.println("🔓 NHẬN LỆNH MỞ KHÓA TỪ SERVER!");
  
    String method = "";
    String user_id = "";
  
    if (message.indexOf("\"method\":\"rfid\"") > 0) {
      method = "rfid";
      Serial.println("   → Phương thức: RFID");
    } else if (message.indexOf("\"method\":\"fingerprint\"") > 0) {
      method = "fingerprint";
      Serial.println("   → Phương thức: Vân tay");
    } else if (message.indexOf("\"method\":\"face\"") > 0) {
      method = "face";
      Serial.println("   → Phương thức: Khuôn mặt");
    
      int userIdStart = message.indexOf("\"user_id\":\"") + 11;
      int userIdEnd = message.indexOf("\"", userIdStart);

      if (userIdStart > 10 && userIdEnd > userIdStart) {
        user_id = message.substring(userIdStart, userIdEnd);
        Serial.print("   → User ID: ");
        Serial.println(user_id);
      }
    } else if (message.indexOf("\"method\":\"remote\"") > 0) {
      method = "remote";
      Serial.println("   → Phương thức: Remote");
    }
  
    unlockDoor();
  
    // gửi xác nhận lên server
    if (method == "face" && user_id.length() > 0) {
      String confirmPayload = "{";
      confirmPayload += "\"device_id\":\"" + device_id + "\",";
      confirmPayload += "\"status\":\"valid\",";
      confirmPayload += "\"user_id\":\"" + user_id + "\",";
      confirmPayload += "\"timestamp\":\"" + String(millis()) + "\"";
      confirmPayload += "}";
      
      mqttClient.publish(topic_face_unlock, confirmPayload.c_str());
      Serial.println("✅ Đã gửi xác nhận face unlock lên server");
      }
      return;
  }

  // ✅ XỬ LÝ TOPIC CONTROL
  String controlTopic = "smartlock/device/" + device_id + "/control";
  if (String(topic) == controlTopic) {
    String message = "";
    for (int i = 0; i < length; i++) {
      message += (char)payload[i];
    }
    
    Serial.println("🔔 Nhận lệnh control:");
    Serial.println(message);
    
    if (message.indexOf("\"action\":\"deny\"") > 0) {
      Serial.println("✗ Server từ chối - Thẻ/vân tay không hợp lệ");
    }
    
    return;
  }

  // ✅ XỬ LÝ LOGIN RESPONSE
  if (String(topic) == topic_device_login_response) {
    parseDeviceLoginResponse(message);
    return;
  }

  // ✅ XỬ LÝ ENROLL FINGERPRINT 
  String enrollFingerprintTopic = "smartlock/device/" + device_id + "/enroll/fingerprint";
  if (String(topic) == enrollFingerprintTopic) {
    if (message.startsWith("ENROLL_FINGERPRINT:")) {
      if (!device_authenticated) {
        Serial.println("✗ Device chưa login - Từ chối enroll");
        return;
      }
      
      // Parse command và bắt đầu enroll
      int firstColon = message.indexOf(':');
      int secondColon = message.indexOf(':', firstColon + 1);
      
      enrollingFingerprintUserId = message.substring(firstColon + 1, secondColon);
      enrollingFingerprintId = message.substring(secondColon + 1).toInt();
      enrollingFingerprint = true;
      
      Serial.println("✓ Bắt đầu enroll vân tay - Device đã xác thực");
      enrollFingerprintRemote(enrollingFingerprintId, enrollingFingerprintUserId);
    }
    return;
  }

  // ✅ XỬ LÝ DELETE FINGERPRINT 
  String deleteFingerprintTopic = "smartlock/device/" + device_id + "/delete/fingerprint";
  if (String(topic) == deleteFingerprintTopic) {
    if (message.startsWith("DELETE_FINGERPRINT:")) {
      if (!device_authenticated) {
        Serial.println("✗ Device chưa login - Từ chối xóa vân tay");
        
        // Gửi kết quả thất bại
        int firstColon = message.indexOf(':');
        int secondColon = message.indexOf(':', firstColon + 1);
        String userId = message.substring(firstColon + 1, secondColon);
        int fingerprintId = message.substring(secondColon + 1).toInt();
        
        sendDeleteResult(false, fingerprintId, userId, "Device chưa xác thực");
        return;
      }
      
      // Format: DELETE_FINGERPRINT:userId:fingerprintId
      int firstColon = message.indexOf(':');
      int secondColon = message.indexOf(':', firstColon + 1);
      
      deletingFingerprintUserId = message.substring(firstColon + 1, secondColon);
      deletingFingerprintId = message.substring(secondColon + 1).toInt();
      deletingFingerprint = true;
      
      Serial.println("=================================");
      Serial.println("🗑️ NHAN LENH XOA VAN TAY");
      Serial.print("   Device ID: ");
      Serial.println(device_id);
      Serial.print("   User ID: ");
      Serial.println(deletingFingerprintUserId);
      Serial.print("   Fingerprint ID: ");
      Serial.println(deletingFingerprintId);
      Serial.println("=================================");
      
      // Thực hiện xóa ngay
      deleteFingerprintRemote(deletingFingerprintId, deletingFingerprintUserId);
    }
    return;
  }

  // ✅ XỬ LÝ ENROLL RFID
  String enrollRFIDTopic = "smartlock/device/" + device_id + "/enroll/rfid";
  if (String(topic) == enrollRFIDTopic) {
    if (message.startsWith("ENROLL_RFID:")) {
      if (!device_authenticated) {
        Serial.println("✗ Device chưa login - Từ chối enroll");
        return;
      }
      enrollingRFIDUserId = message.substring(12);
      enrollingRFID = true;
      Serial.println("✓ Bắt đầu enroll RFID - Device đã xác thực");
    }
    return;
  }
}

void clearDeviceCredentials() {
  Serial.println("\n=== XÓA CREDENTIALS ===");
  
  bool success = true;
  
  // Xóa device certificate
  if (SPIFFS.exists(CERTIFICATE_FILE)) {
    if (SPIFFS.remove(CERTIFICATE_FILE)) {
      Serial.println("✓ Đã xóa device certificate");
    } else {
      Serial.println("✗ Lỗi xóa device certificate");
      success = false;
    }
  }
  
  // Xóa CA certificate
  if (SPIFFS.exists(CA_CERT_FILE)) {
    if (SPIFFS.remove(CA_CERT_FILE)) {
      Serial.println("✓ Đã xóa CA certificate");
    } else {
      Serial.println("✗ Lỗi xóa CA certificate");
      success = false;
    }
  }
  
  // Reset states
  device_certificate = "";
  device_authenticated = false;
  session_token = "";
  ca_cert_loaded = false;
  
  if (success) {
    Serial.println("✅ Đã xóa tất cả credentials!");
  } else {
    Serial.println("⚠️ Có lỗi khi xóa credentials");
  }
  
  Serial.println("=========================\n");
}

void performFactoryReset() {
  Serial.println("\n=== FACTORY RESET ===");
  
  // 1. Xóa credentials
  clearDeviceCredentials();
  
  // 2. Xóa RSA keys (tuỳ chọn - nếu muốn giữ keys thì comment dòng này)
  if (SPIFFS.exists(PRIVATE_KEY_FILE)) {
    SPIFFS.remove(PRIVATE_KEY_FILE);
    Serial.println("✓ Đã xóa private key");
  }
  
  if (SPIFFS.exists(PUBLIC_KEY_FILE)) {
    SPIFFS.remove(PUBLIC_KEY_FILE);
    Serial.println("✓ Đã xóa public key");
  }
  
  // 3. Reset all states
  device_certificate = "";
  device_authenticated = false;
  session_token = "";
  ca_cert_loaded = false;
  rsa_keys_ready = false;
  device_challenge = "";
  provisioning_completed = false;
  
  Serial.println("✅ FACTORY RESET HOÀN TẤT!");
  Serial.println("⚠️ Cần đăng ký lại device từ admin");
  Serial.println("📡 Đang reconnect MQTT...");
  Serial.println("=========================\n");
  
  // 4. Disconnect MQTT
  mqttClient.disconnect();
  delay(1000);
  
  // 5. Restart ESP32 (tuỳ chọn)
  // ESP.restart();
}

// ========================================
// SECTION 7: SETUP & LOOP
// ========================================

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  Serial.begin(57600);
  delay(100);

  Serial.println("Khoi dong he thong Smart Lock...");

  setupWiFi();

  // ✅ Khởi tạo RSA keys TRƯỚC KHI kết nối MQTT
  if (!initRSAKeys()) {
    Serial.println("✗ LỖI NGHIÊM TRỌNG: Không thể khởi tạo RSA keys!");
    Serial.println("Device sẽ không thể đăng ký!");
  }

  initCACertificate();

  mqttClient.setBufferSize(2048);
  
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(60);
  mqttClient.setSocketTimeout(30);

  fingerSerial.begin(57600, SERIAL_8N1, FINGER_RX, FINGER_TX);
  finger.begin(57600);
  delay(500);

  uint8_t templateCount = finger.getTemplateCount();
  Serial.print("So luong van tay da luu trong module: ");
  Serial.println(templateCount);

  SPI.begin(18, 19, 23, SS_PIN);
  rfid.PCD_Init();
  Serial.println("RFID da san sang!");

  // ✅ KIỂM TRA CERTIFICATE
  if (SPIFFS.exists(CERTIFICATE_FILE)) {
    File file = SPIFFS.open(CERTIFICATE_FILE, FILE_READ);
    if (file) {
      device_certificate = file.readString();
      file.close();
      Serial.println("✓ Đã load certificate từ SPIFFS");
      
      // Verify certificate nếu có CA cert
      if (ca_cert_loaded) {
        if (verifyDeviceCertificate(device_certificate)) {
          Serial.println("✅ Device certificate hợp lệ!");
        } else {
          Serial.println("⚠️ Device certificate KHÔNG hợp lệ!");
          Serial.println("Cần đăng ký lại device");
          device_certificate = "";
        }
      }
    }
  }

  // Subscribe disconnect topic
  String disconnectTopic = "smartlock/device/" + device_id + "/disconnect";
  mqttClient.subscribe(disconnectTopic.c_str());
  Serial.print("Da subscribe: ");
  Serial.println(disconnectTopic);
}

void loop() {
  // ✅ THÊM: Auto reconnect sau khi provision xong
  if (provisioning_completed) {
    unsigned long elapsed = millis() - provision_complete_time;
    
    if (elapsed >= 3000 && elapsed < 5000) { // Chỉ chạy 1 lần trong khoảng 3-5s
      Serial.println("\n🔄 RECONNECTING MQTT AFTER PROVISIONING...");
      
      // Reset states
      provisioning_completed = false;
      device_authenticated = false;
      session_token = "";
      login_request_sent = false;
      
      // Disconnect và reconnect
      mqttClient.disconnect();
      delay(1000);
      
      Serial.println("✓ Reconnecting...");
      // Hàm mqttReconnect() sẽ tự động gọi sendDeviceLogin()
    }
  }

  if (!mqttClient.connected()) {
    mqttReconnect();
  }
  mqttClient.loop();

   // ✅ XỬ LÝ UNLOCK STATE (NON-BLOCKING)
  if (unlockState == UNLOCKING) {
    if (millis() - unlockStartTime >= UNLOCK_DURATION) {
      digitalWrite(RELAY_PIN, LOW);
      mqttClient.publish(topic_status, "{\"status\":\"locked\"}");
      Serial.println("🔒KHOÁ CỬA");
      
      // ✅ RESET STATE
      unlockState = IDLE;
      isUnlocking = false;

      resetRFIDDebounce();

      Serial.println("✓ Đã reset unlock state - Sẵn sàng nhận lệnh mới");
    }
    return;
  }

  // ✅ XỬ LÝ LOGIN TIMEOUT
  if (login_request_sent && !device_authenticated) {
    unsigned long elapsed = millis() - login_request_time;
    
    if (elapsed > LOGIN_TIMEOUT) {
      Serial.println("⏱️ Login timeout - Gửi lại request...");
      sendDeviceLogin();
      login_request_time = millis(); 
    }
  }

  //✅ GỬI HEARTBEAT định kỳ 
  if (device_authenticated && 
      (millis() - last_heartbeat >= HEARTBEAT_INTERVAL)) {
    sendHeartbeat();
  }

  // ✅ 5. XỬ LÝ VÂN TAY 
  static unsigned long lastFingerprintCheck = 0;
  if (millis() - lastFingerprintCheck >= fingerprintCheckInterval) {
    lastFingerprintCheck = millis();

    int fingerprintID = getFingerprintID();
    if (fingerprintID >= 0) {
      Serial.print("✓ VÂN TAY HỢP LỆ! ID: "); 
      Serial.println(fingerprintID);
      
      String authMsg = String("{\"fingerprintId\":") + String(fingerprintID) + 
                       String(",\"status\":\"valid\"") +
                       String(",\"device_id\":\"") + device_id + String("\"") +
                       String(",\"timestamp\":\"") + String(millis()) + String("\"}");
      
      bool published = mqttClient.publish(topic_fingerprint, authMsg.c_str());
      
      if (published) {
        Serial.println("✓ Đã gửi xác thực vân tay lên server");
        
        for (int i = 0; i < 10; i++) {
          mqttClient.loop();
          delay(50);
        }
      } else {
        Serial.println("✗ MQTT publish thất bại!");
      }
      
    } else if (fingerprintID == -2) {
      Serial.println("✗ Vân tay không hợp lệ");
      
      String authMsg = String("{\"fingerprintId\":-1") +
                       String(",\"status\":\"invalid\"") +
                       String(",\"device_id\":\"") + device_id + String("\"") +
                       String(",\"timestamp\":\"") + String(millis()) + String("\"}");
      
      mqttClient.publish(topic_fingerprint, authMsg.c_str());
      
      for (int i = 0; i < 5; i++) {
        mqttClient.loop();
        delay(50);
      }
    }
  }

  // ✅ 6. XỬ LÝ RFID 
  static unsigned long lastRFIDCheck = 0;
  if (millis() - lastRFIDCheck < 300) {
    return;
  }
  lastRFIDCheck = millis();
  
  if (!rfid.PICC_IsNewCardPresent()) {
    return; 
  }
  
  // ✅ Đọc thẻ
  if (!rfid.PICC_ReadCardSerial()) {
    Serial.println("⚠️ Không đọc được serial thẻ");
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  // ✅ Đọc UID thành công
  String uidString = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidString += "0";
    uidString += String(rfid.uid.uidByte[i], HEX);
  }
  uidString.toUpperCase();

  Serial.println("🔍 PHÁT HIỆN THẺ RFID!");
  Serial.print("   UID: ");
  Serial.println(uidString);

  // ✅ DEBOUNCE: Kiểm tra trùng lặp
  unsigned long currentTime = millis();
  bool isDuplicate = (uidString == lastCardUID) && 
                    ((currentTime - lastCardTime) < CARD_DEBOUNCE_TIME);
  
  if (isDuplicate) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    delay(200); 
    return;
  }

  // ✅ Thẻ mới hợp lệ → Xử lý
  lastCardUID = uidString;
  lastCardTime = currentTime;

  if (enrollingRFID) {
    // CHẾ ĐỘ ENROLLMENT
    Serial.println("   → CHẾ ĐỘ: Enroll RFID");
    
    String msg = "{\"status\":\"success\",\"cardUid\":\"" + uidString + 
                 "\",\"userId\":\"" + enrollingRFIDUserId + 
                 "\",\"device_id\":\"" + device_id + "\"}";
    
    bool published = mqttClient.publish("smartlock/enroll/rfid", msg.c_str());
    
    if (published) {
      Serial.println("   ✓ Đã gửi enroll RFID");
      enrollingRFID = false;
      enrollingRFIDUserId = "";
    } else {
      Serial.println("   ✗ MQTT publish thất bại!");
    }
    
  } else {
    // CHẾ ĐỘ CHECK BÌNH THƯỜNG
    Serial.println("   → CHẾ ĐỘ: Check RFID");
    
  String msg = "{\"cardUid\":\"" + uidString + 
               "\",\"device_id\":\"" + device_id + 
               "\",\"session_token\":\"" + session_token + "\"}";
    
    bool published = mqttClient.publish("smartlock/check/rfid", msg.c_str());
    
    if (published) {
      Serial.println("   ✓ Đã gửi check RFID lên server");
    } else {
      Serial.println("   ✗ MQTT publish thất bại!");
    }
  }
  
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(200);
  
  for (int i = 0; i < 10; i++) {
    mqttClient.loop();
    delay(50);
  }
}
