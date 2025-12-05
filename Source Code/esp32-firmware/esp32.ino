#define MQTT_MAX_PACKET_SIZE 2048  

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
#include "SPIFFS.h"  // Để lưu private key
#include "mbedtls/x509_crt.h"  // ✅ THÊM: Để parse và verify certificate


// --- WiFi Configuration ---
const char* ssid = "DTH";
const char* password = "huyendang2k4";

// --- MQTT Configuration ---
const char* mqtt_server = "6c6c58328eae454b8e3f8680129d7d32.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "smart_lock_nhom7_iot";
const char* mqtt_password = "Nhom7iot";

// MQTT Topics
const char* topic_status = "smartlock/status";
const char* topic_fingerprint = "smartlock/sensor/fingerprint";
const char* topic_rfid = "smartlock/sensor/rfid";
const char* topic_command = "smartlock/control";
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

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// --- Relay ---
#define RELAY_PIN 14

// --- Fingerprint AS608 ---
HardwareSerial fingerSerial(1);
#define FINGER_RX 17
#define FINGER_TX 16
Adafruit_Fingerprint finger(&fingerSerial);

// --- RFID RC522 ---
#define SS_PIN   2
#define RST_PIN  4
MFRC522 rfid(SS_PIN, RST_PIN);

// --- Biến trạng thái enroll RFID ---
bool enrollingRFID = false;
String enrollingRFIDUserId = "";

// Biến trạng thái enroll fingerprint
bool enrollingFingerprint = false;
String enrollingFingerprintUserId = "";
int enrollingFingerprintId = -1;

// Biến trạng thái delete fingerprint
bool deletingFingerprint = false;
String deletingFingerprintUserId = "";
int deletingFingerprintId = -1;

// Biến để tránh gửi thông báo liên tục
unsigned long lastFingerprintCheck = 0;
const unsigned long fingerprintCheckInterval = 2000; // 2 giây

// Biến lưu trữ
String device_id = "ESP32_SMARTLOCK_001";
// String provisioning_token = "";
String device_challenge = "";
String device_certificate = "";

// === RSA Key Management ===
mbedtls_pk_context pk_ctx;
mbedtls_entropy_context entropy;
mbedtls_ctr_drbg_context ctr_drbg;
bool rsa_keys_ready = false;

// File path cho CA certificate
const char* CA_CERT_FILE = "/ca_cert.pem";

// Context cho CA certificate
mbedtls_x509_crt ca_cert;
bool ca_cert_loaded = false;

// File paths
const char* PRIVATE_KEY_FILE = "/private_key.pem";
const char* PUBLIC_KEY_FILE = "/public_key.pem";
const char* CERTIFICATE_FILE = "/device_cert.pem";

// --- WiFi Connection ---
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.print("Ket noi WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);  // Đặt chế độ Station
  WiFi.begin(ssid, password);

  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED && attempt < 40) {
    delay(500);
    Serial.print(".");
    attempt++;
    
    // In trạng thái WiFi mỗi 5 lần thử
    if (attempt % 5 == 0) {
      Serial.println();
      Serial.print("Trang thai WiFi: ");
      Serial.println(WiFi.status());
      Serial.print("So lan thu: ");
      Serial.println(attempt);
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi da ket noi!");
    Serial.print("Dia chi IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("");
    Serial.println("LOI: Khong the ket noi WiFi!");
    Serial.println("Vui long kiem tra:");
    Serial.println("1. Ten WiFi va mat khau co dung khong?");
    Serial.println("2. WiFi co dang bat khong?");
    Serial.println("3. ESP32 co gan router khong?");
    Serial.println("4. WiFi co phai 2.4GHz khong? (ESP32 khong ho tro 5GHz)");
    Serial.println("\nThu khoi dong lai ESP32...");
    delay(5000);
    ESP.restart();  // Khởi động lại ESP32
  }
}

// ============================================
// HÀM KHỞI TẠO CA CERTIFICATE
// ============================================

bool initCACertificate() {
  Serial.println("\n=================================");
  Serial.println("🔐 KHỞI TẠO CA CERTIFICATE");
  Serial.println("=================================");
  
  mbedtls_x509_crt_init(&ca_cert);
  
  // Kiểm tra file CA cert đã tồn tại chưa
  if (!SPIFFS.exists(CA_CERT_FILE)) {
    Serial.println("⚠️ CA Certificate chưa tồn tại");
    Serial.println("Cần yêu cầu CA cert từ server");
    Serial.println("=================================\n");
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

// ============================================
// HÀM LƯU CA CERTIFICATE (Nhận từ server)
// ============================================

bool saveCACertificate(String caCertPem) {
  Serial.println("💾 Đang lưu CA certificate...");

  // ✅ SỬA: Replace cả \r\n và \n
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
  
  // Load CA cert vào memory
  return initCACertificate();
}

// ============================================
// HÀM VERIFY DEVICE CERTIFICATE
// ============================================

bool verifyDeviceCertificate(String deviceCertPem) {
  Serial.println("\n=================================");
  Serial.println("🔍 VERIFY DEVICE CERTIFICATE");
  Serial.println("=================================");
  
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
                                NULL,  // CRL (Certificate Revocation List) - NULL nếu không dùng
                                NULL,  // CN (Common Name) - NULL để không check CN
                                &flags,
                                NULL,  // Verify callback
                                NULL); // Callback context
  
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

// ============================================
// HÀM KIỂM TRA CERTIFICATE CÒN HẠN
// ============================================

bool isCertificateValid() {
  if (device_certificate.length() == 0) {
    return false;
  }
  
  // Parse certificate
  mbedtls_x509_crt cert;
  mbedtls_x509_crt_init(&cert);
  
  int ret = mbedtls_x509_crt_parse(&cert, 
                                   (const unsigned char*)device_certificate.c_str(), 
                                   device_certificate.length() + 1);
  
  if (ret != 0) {
    mbedtls_x509_crt_free(&cert);
    return false;
  }
  
  // Kiểm tra thời hạn (so với thời gian hiện tại)
  // Note: ESP32 cần có thời gian chính xác (sync qua NTP)
  
  // Tạm thời return true (cần implement NTP để có thời gian chính xác)
  mbedtls_x509_crt_free(&cert);
  
  Serial.println("⚠️ TODO: Implement NTP time sync để check validity");
  return true;
}


// ============================================
// PHẦN 2: RSA KEY MANAGEMENT (ĐÃ SỬA)
// ============================================

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
  
  // ✅ SỬA: Thêm context vào hàm gen_key
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
  
  // ✅ SỬA: Parse key với mbedtls_pk_parse_key
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
  Serial.println("\n=================================");
  Serial.println("🔐 KHỞI TẠO RSA KEYS");
  Serial.println("=================================");
  
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
      Serial.println("=================================\n");
      return true;
    } else {
      Serial.println("⚠️ Load keys thất bại, sẽ xóa và tạo mới...");
      SPIFFS.remove(PRIVATE_KEY_FILE);
      SPIFFS.remove(PUBLIC_KEY_FILE);
    }
  }
  
  // Tạo keys mới
  Serial.println("⚠️ Đang tạo RSA keypair mới...");
  Serial.println("Vui lòng CHỜ 30-45 giây...\n");
  
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
  Serial.println("=================================\n");
  
  return true;
}

// ✅ HÀM TẠO PUBLIC KEY (ĐÃ SỬA)
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

// ✅ HÀM KÝ CHALLENGE (ĐÃ SỬA - QUAN TRỌNG NHẤT)
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
  
  // ✅ SỬA QUAN TRỌNG: Dùng mbedtls_pk_sign thay vì mbedtls_rsa_pkcs1_sign
  ret = mbedtls_pk_sign(&pk_ctx, 
                        MBEDTLS_MD_SHA256,
                        hash, 
                        32,
                        signature,
                        sizeof(signature),  // ✅ THÊM: sig_size
                        &sig_len,
                        mbedtls_ctr_drbg_random, 
                        &ctr_drbg);
  
  if (ret != 0) {
    Serial.printf("✗ Lỗi sign: -0x%04x\n", -ret);
    return "";
  }
  
  Serial.printf("✓ Signature length: %d bytes\n", sig_len);
  
  // Debug: In ra signature
  Serial.print("Signature (hex first 32 bytes): ");
  for(int i = 0; i < 32 && i < sig_len; i++) {
    Serial.printf("%02x", signature[i]);
  }
  Serial.println("...");
  
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
  
  Serial.println("✓ Signature (base64):");
  Serial.println(signedChallenge.substring(0, 64) + "...");
  Serial.printf("✓ Base64 length: %d characters\n", signedChallenge.length());
  
  return signedChallenge;
}



// --- MQTT Callback ---
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Nhan tin nhan tu topic: ");
  Serial.println(topic);
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print("Noi dung: ");
  Serial.println(message);

  // ✅ XỬ LÝ NHẬN CA CERTIFICATE TỪ SERVER
  String caCertTopic = "smartlock/device/" + device_id + "/ca_certificate";
  if (String(topic) == caCertTopic) {
    Serial.println("📥 Nhận CA Certificate từ server");
    
    // Parse JSON để lấy CA cert
    int certStart = message.indexOf("\"ca_certificate\":\"") + 18;
    int certEnd = message.lastIndexOf("\"");
    
    if (certStart > 17 && certEnd > certStart) {
      String caCertPem = message.substring(certStart, certEnd);

      // ✅ SỬA: Replace cả \r\n và \n
    caCertPem.replace("\\r\\n", "\n");
    caCertPem.replace("\\n", "\n");
      
      if (saveCACertificate(caCertPem)) {
        Serial.println("✅ CA Certificate đã lưu và load thành công!");
      } else {
        Serial.println("✗ Lỗi lưu CA Certificate");
      }
    }
    return;
  }

  // ✅ XỬ LÝ NHẬN TOKEN TỪ TOPIC RIÊNG
  String deviceProvisionTopic = "smartlock/device/" + device_id + "/provision/token";
  if (String(topic) == deviceProvisionTopic) {
    Serial.println("📥 Nhận provisioning token TỪ TOPIC RIÊNG của thiết bị này");
    parseProvisionToken(message);
    return;
  }

  // ✅ XỬ LÝ PROVISION RESPONSE (ĐÃ SỬA)
  if (String(topic) == topic_device_provision_res) {
    Serial.println("📥 Nhận provision response từ server");
    parseProvisionResponse(message); // ✅ Parse JSON
    return;
  }

  // ✅ XỬ LÝ FINALIZE RESPONSE (ĐÃ SỬA)
  if (String(topic) == topic_device_finalize_res) {
    Serial.println("📥 Nhận finalize response từ server");
    parseFinalizeResponse(message); // ✅ Parse JSON
    return;
  }

  // ✅ XỬ LÝ TOPIC UNLOCK (THÊM ĐOẠN NÀY)
  if (String(topic) == topic_unlock) {
    Serial.println("=================================");
    Serial.println("🔓 NHAN LENH MO KHOA TU SERVER");
    Serial.println("=================================");
    unlockDoor();
    return;
  }

  // ✅ XỬ LÝ ENROLL FINGERPRINT
  if (String(topic) == topic_enroll_fingerprint) {
    if (message.startsWith("ENROLL_FINGERPRINT:")) {
      // Format: ENROLL_FINGERPRINT:userId:fingerprintId
      int firstColon = message.indexOf(':');
      int secondColon = message.indexOf(':', firstColon + 1);
      
      enrollingFingerprintUserId = message.substring(firstColon + 1, secondColon);
      enrollingFingerprintId = message.substring(secondColon + 1).toInt();
      enrollingFingerprint = true;
      
      Serial.println("=================================");
      Serial.println("🔔 NHAN LENH ENROLL VAN TAY");
      Serial.print("   User ID: ");
      Serial.println(enrollingFingerprintUserId);
      Serial.print("   Fingerprint ID: ");
      Serial.println(enrollingFingerprintId);
      Serial.println("   Vui long dat ngon tay vao cam bien...");
      Serial.println("=================================");
      
      // Bắt đầu quá trình enrollment
      enrollFingerprintRemote(enrollingFingerprintId, enrollingFingerprintUserId);
    }
  }

  // ✅ XỬ LÝ DELETE FINGERPRINT
if (String(topic) == topic_delete_fingerprint) {
  if (message.startsWith("DELETE_FINGERPRINT:")) {
    // Format: DELETE_FINGERPRINT:userId:fingerprintId
    int firstColon = message.indexOf(':');
    int secondColon = message.indexOf(':', firstColon + 1);
    
    deletingFingerprintUserId = message.substring(firstColon + 1, secondColon);
    deletingFingerprintId = message.substring(secondColon + 1).toInt();
    deletingFingerprint = true;
    
    Serial.println("=================================");
    Serial.println("🗑️ NHAN LENH XOA VAN TAY");
    Serial.print("   User ID: ");
    Serial.println(deletingFingerprintUserId);
    Serial.print("   Fingerprint ID: ");
    Serial.println(deletingFingerprintId);
    Serial.println("=================================");
    
    // Thực hiện xóa ngay
    deleteFingerprintRemote(deletingFingerprintId, deletingFingerprintUserId);
  }
}

  // ✅ XỬ LÝ TOPIC ENROLL RFID
  if (String(topic) == topic_enroll_rfid) {
    if (message.startsWith("ENROLL_RFID:")) {
      enrollingRFIDUserId = message.substring(12); // Lấy userId (sau "ENROLL_RFID:")
      enrollingRFID = true;
      Serial.println("=================================");
      Serial.println("🔔 NHAN LENH ENROLL THE RFID");
      Serial.print("   User ID: ");
      Serial.println(enrollingRFIDUserId);
      Serial.println("   Vui long dat the len cam bien...");
      Serial.println("=================================");
    }
  }
}

// --- MQTT Reconnect ---
void mqttReconnect() {
  while (!mqttClient.connected()) {
    Serial.print("Ket noi MQTT...");
    
    String clientId = "ESP32_SmartLock_";
    clientId += String(random(0xffff), HEX);
    
    if (mqttClient.connect(clientId.c_str(), mqtt_user, mqtt_password)) {
      Serial.println("da ket noi!");

      // ✅ Kiểm tra buffer size sau khi connect
      Serial.print("✓ MQTT Buffer Size: ");
      Serial.print(mqttClient.getBufferSize());
      Serial.println(" bytes");
      
      mqttClient.subscribe(topic_command);
      Serial.print("Da subscribe topic: ");
      Serial.println(topic_command);

      mqttClient.subscribe(topic_enroll_rfid);  // ✅ THÊM DÒNG NÀY
      Serial.print("Da subscribe topic: ");
      Serial.println(topic_enroll_rfid);

      mqttClient.subscribe(topic_enroll_fingerprint);
      Serial.print("Da subscribe topic: ");
      Serial.println(topic_enroll_fingerprint);

      mqttClient.subscribe(topic_delete_fingerprint);
      Serial.print("Da subscribe topic: ");
      Serial.println(topic_delete_fingerprint);

      mqttClient.subscribe(topic_unlock);  // ✅ THÊM DÒNG NÀY
      Serial.print("Da subscribe topic: ");
      Serial.println(topic_unlock);

      // // ✅ Subscribe các topic (THÊM topic mới)
      // mqttClient.subscribe(topic_device_provision_token); // ✅ Topic mới
      // Serial.println("Da subscribe: smartlock/device/provision/token");

      // ✅ SỬA: SUBSCRIBE TOPIC RIÊNG CỦA DEVICE NÀY
      String deviceProvisionTopic = "smartlock/device/" + device_id + "/provision/token";
      mqttClient.subscribe(deviceProvisionTopic.c_str());
      Serial.print("Da subscribe: ");
      Serial.println(deviceProvisionTopic);

      mqttClient.subscribe(topic_device_provision_res);
  Serial.println("Da subscribe: smartlock/device/provision/response");
  
  mqttClient.subscribe(topic_device_finalize_res);
  Serial.println("Da subscribe: smartlock/device/finalize/response");

  // ✅ THÊM ĐOẠN NÀY:
String caCertTopic = "smartlock/device/" + device_id + "/ca_certificate";
mqttClient.subscribe(caCertTopic.c_str());
Serial.print("Da subscribe: ");
Serial.println(caCertTopic);
      
      mqttClient.publish(topic_status, "{\"status\":\"online\"}");
      
    } else {
      Serial.print("that bai, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" thu lai sau 5 giay");
      delay(5000);
    }
  }
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  Serial.begin(57600);
  delay(100);

  Serial.println("Khoi dong he thong Smart Lock...");

  setupWiFi();

  // ✅ THÊM: Khởi tạo RSA keys TRƯỚC KHI kết nối MQTT
  if (!initRSAKeys()) {
    Serial.println("✗ LỖI NGHIÊM TRỌNG: Không thể khởi tạo RSA keys!");
    Serial.println("Device sẽ không thể đăng ký!");
    // Vẫn tiếp tục chạy để có thể unlock bằng RFID/vân tay
  }

  // ✅ THÊM: Khởi tạo CA Certificate (nếu có)
  initCACertificate();

  espClient.setInsecure();

  // ✅ Set buffer size trước khi setServer
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

  // ✅ THÊM: Kiểm tra nếu chưa có certificate thì request provision
  if (device_certificate.length() == 0) {
    Serial.println("\n⚠️ Thiết bị chưa được đăng ký!");
    Serial.println("Đang chờ provisioning token từ server...");
    Serial.println("Vui lòng tạo device trên app để nhận token\n");
  } else {
    Serial.println("✓ Thiết bị đã có certificate, sẵn sàng hoạt động");
  }
}

// ============================================
// HÀM REQUEST CA CERTIFICATE TỪ SERVER
// ============================================

void requestCACertificate() {
  Serial.println("📤 Yêu cầu CA Certificate từ server...");
  
  String topic = "smartlock/device/" + device_id + "/request_ca_cert";
  String payload = "{\"device_id\":\"" + device_id + "\"}";
  
  mqttClient.publish(topic.c_str(), payload.c_str());
  Serial.println("✓ Đã gửi request CA cert");
}

// ============================================
// HELPER: CLEAN UP CERTIFICATES
// ============================================

void cleanupCertificates() {
  mbedtls_x509_crt_free(&ca_cert);
  ca_cert_loaded = false;
  
  SPIFFS.remove(CA_CERT_FILE);
  SPIFFS.remove(CERTIFICATE_FILE);
  
  device_certificate = "";
  
  Serial.println("✓ Đã xóa tất cả certificates");
}

void loop() {
  if (!mqttClient.connected()) {
    mqttReconnect();
  }
  mqttClient.loop();

  // --- Quét vân tay với khoảng thời gian ---
  if (millis() - lastFingerprintCheck >= fingerprintCheckInterval) {
    lastFingerprintCheck = millis();
    
    int fingerprintID = getFingerprintID();
    if (fingerprintID >= 0) {
      // Vân tay hợp lệ
      Serial.print(">> VAN TAY HOP LE! ID: "); 
      Serial.println(fingerprintID);
      
      String authMsg = "{\"fingerprintId\":" + String(fingerprintID) + 
                       ",\"status\":\"valid\",\"timestamp\":\"" + String(millis()) + "\"}";
      mqttClient.publish(topic_fingerprint, authMsg.c_str());
      Serial.println("Da gui thong tin van tay hop le len MQTT");
      
      unlockDoor();
      delay(1000);
    } else if (fingerprintID == -2) {
      // Vân tay không hợp lệ (có ngón tay nhưng không khớp)
      Serial.println(">> VAN TAY KHONG HOP LE!");
      
      String authMsg = "{\"fingerprintId\":-1,\"status\":\"invalid\",\"timestamp\":\"" + String(millis()) + "\"}";
      mqttClient.publish(topic_fingerprint, authMsg.c_str());
      Serial.println("Da gui thong tin van tay khong hop le len MQTT");
      
      delay(1000); // Delay để tránh spam
    }
  }

//------------------------
// Thay thế phần xử lý RFID trong loop() của bạn
if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uidString = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (rfid.uid.uidByte[i] < 0x10) uidString += "0";
      uidString += String(rfid.uid.uidByte[i], HEX);
    }
    uidString.toUpperCase();

    if (enrollingRFID) {
      // CHẾ ĐỘ ENROLLMENT - Gửi vào topic enroll
      String msg = "{\"status\":\"success\",\"cardUid\":\"" + uidString + "\",\"userId\":\"" + enrollingRFIDUserId + "\"}";
      mqttClient.publish("smartlock/enroll/rfid", msg.c_str());
      Serial.println("Da gui UID the len server de enroll");
      Serial.print("CardUid: ");
      Serial.println(uidString);
      Serial.print("UserId: ");
      Serial.println(enrollingRFIDUserId);
      
      // QUAN TRỌNG: Reset trạng thái enrollment SAU KHI gửi
      enrollingRFID = false;
      enrollingRFIDUserId = "";
      
      Serial.println("Da tat che do enroll RFID");
    } else {
      // CHẾ ĐỘ KIỂM TRA BÌNH THƯỜNG - Gửi vào topic check
      String msg = "{\"cardUid\":\"" + uidString + "\"}";
      mqttClient.publish("smartlock/check/rfid", msg.c_str());
      Serial.print("Da gui UID the len server de kiem tra: ");
      Serial.println(uidString);
    }

    // Dừng giao tiếp với thẻ
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    
    // Thêm delay nhỏ để tránh đọc lại thẻ ngay lập tức
    delay(1000);
}
}

// --- Thay thế checkUID cũ ---
bool checkUID(byte *uid, byte size) {
  // Chuyển UID thành string HEX để dễ so sánh
  String uidString = "";
  for (byte i = 0; i < size; i++) {
    if (uid[i] < 0x10) uidString += "0";
    uidString += String(uid[i], HEX);
  }
  uidString.toUpperCase(); // Chuẩn hóa chữ hoa

  // Gửi request đến server để kiểm tra UID trong database
  // Ở đây tạm ví dụ bằng MQTT, bạn đã có topic enroll/rfid
  String msg = "{\"cardUid\":\"" + uidString + "\"}";
  mqttClient.publish("smartlock/check/rfid", msg.c_str());
  Serial.print("Da gui UID thẻ len server de kiem tra: ");
  Serial.println(uidString);

  // Chỉ return true để code biên dịch (thực tế server sẽ trả kết quả qua MQTT)
  return false; 
}

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

// --- Mở khóa ---
void unlockDoor() {
  Serial.println("\n=================================");
  Serial.println("🔓 ĐANG MỞ KHÓA...");
  Serial.println("=================================");
  
  digitalWrite(RELAY_PIN, HIGH);
  mqttClient.publish(topic_status, "{\"status\":\"unlocked\"}");
  Serial.println("✓ Relay: ON (Mở khóa)");
  
  Serial.println("⏳ Chờ 3 giây...");
  delay(3000);
  
  digitalWrite(RELAY_PIN, LOW);
  mqttClient.publish(topic_status, "{\"status\":\"locked\"}");
  Serial.println("✓ Relay: OFF (Khóa lại)");
  Serial.println("=================================\n");
}


// --- Khóa cửa ---
void lockDoor() {
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("**KHOA DONG**");
  mqttClient.publish(topic_status, "{\"status\":\"locked\"}");
}

// --- Fingerprint functions (ĐÃ SỬA) ---
int getFingerprintID() {
  uint8_t p = finger.getImage();
  if (p == FINGERPRINT_NOFINGER) {
    // Không có ngón tay trên cảm biến
    return -1;
  } else if (p != FINGERPRINT_OK) {
    Serial.print("Loi getImage: "); 
    Serial.println(p);
    return -1;
  }

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.print("Loi image2Tz: "); 
    Serial.println(p);
    return -1;
  }

  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    // Tìm thấy vân tay hợp lệ
    return finger.fingerID;
  } else if (p == FINGERPRINT_NOTFOUND) {
    // Có ngón tay nhưng không khớp với database
    Serial.println("Van tay khong tim thay trong module");
    return -2; // Trả về -2 để phân biệt với trường hợp không có ngón tay
  } else {
    Serial.print("Loi fingerFastSearch: "); 
    Serial.println(p);
    return -1;
  }
}

// --- Xóa vân tay từ xa (được gọi từ server) ---
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

// --- Gửi kết quả xóa lên server ---
void sendDeleteResult(bool success, int fingerprintId, String userId, String reason) {
  String msg = "{\"status\":\"" + String(success ? "success" : "failed") + 
               "\",\"fingerprintId\":" + String(fingerprintId) +
               ",\"userId\":\"" + userId + "\"";
  
  if (!success && reason.length() > 0) {
    msg += ",\"reason\":\"" + reason + "\"";
  }
  
  msg += "}";
  
  mqttClient.publish(topic_delete_fingerprint_result, msg.c_str());
  Serial.println("Da gui ket qua xoa len server:");
  Serial.println(msg);
}

// --- Enroll vân tay từ xa (được gọi từ server) ---
void enrollFingerprintRemote(uint8_t id, String userId) {
  int p = -1;
  
  Serial.println("=== BAT DAU DANG KY VAN TAY TU XA ===");
  Serial.print("ID: ");
  Serial.println(id);
  Serial.print("User ID: ");
  Serial.println(userId);
  
  // Bước 1: Lấy hình ảnh lần 1
  Serial.println("Buoc 1: Dat ngon tay vao cam bien...");
  unsigned long startTime = millis();
  while (p != FINGERPRINT_OK) {
    // Timeout sau 15 giây
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
    // Timeout sau 15 giây
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

// --- Gửi kết quả enrollment lên server ---
void sendEnrollResult(bool success, int fingerprintId, String userId, String reason) {
  String msg = "{\"status\":\"" + String(success ? "success" : "failed") + 
               "\",\"fingerprintId\":" + String(fingerprintId) +
               ",\"userId\":\"" + userId + "\"";
  
  if (!success && reason.length() > 0) {
    msg += ",\"reason\":\"" + reason + "\"";
  }
  
  msg += "}";
  
  mqttClient.publish(topic_enroll_fingerprint_result, msg.c_str());
  Serial.println("Da gui ket qua enrollment len server:");
  Serial.println(msg);
}

// ✅ HÀM PARSE TOKEN VÀ TỰ ĐỘNG BẮT ĐẦU PROVISION
void parseProvisionToken(String jsonString) {
  Serial.println("=================================");
  Serial.println("🔐 BẮT ĐẦU ĐĂNG KÝ THIẾT BỊ TỰ ĐỘNG");
  Serial.println("=================================");
  
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
  
  // ✅ TỰ ĐỘNG BẮT ĐẦU PROVISION
  delay(1000); // Delay nhỏ để ổn định
  sendProvisionRequest(provisioningToken);
}

// Xóa keys (để test lại từ đầu)
void deleteRSAKeys() {
  SPIFFS.remove(PRIVATE_KEY_FILE);
  SPIFFS.remove(PUBLIC_KEY_FILE);
  mbedtls_pk_free(&pk_ctx);
  rsa_keys_ready = false;
  Serial.println("✓ Đã xóa RSA keys");
}

// ✅ Hàm lưu certificate vào EEPROM/SPIFFS
void saveCertificate(String certificate) {
  Serial.println("⚠️ TODO: Implement lưu certificate vào SPIFFS/EEPROM");
  Serial.println("Certificate nhận được:");
  Serial.println(certificate);
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

// ============================================
// SỬA HÀM parseFinalizeResponse
// ============================================

void parseFinalizeResponse(String jsonString) {
  if (jsonString.indexOf("\"success\":true") > 0) {
    Serial.println("✓ Finalize thành công!");
    
    int certStart = jsonString.indexOf("\"certificate\":\"") + 15;
    int certEnd = jsonString.lastIndexOf("\"");
    
    if (certStart > 14 && certEnd > certStart) {
      device_certificate = jsonString.substring(certStart, certEnd);

          // ✅ SỬA: Replace cả \r\n và \n
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
          Serial.println("Device đã sẵn sàng!");
        } else {
          Serial.println("✗ Certificate verification thất bại!");
          Serial.println("KHÔNG lưu certificate!");
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
        delay(500); // Delay nhỏ để ổn định MQTT
        requestCACertificate();
        
        // Đợi 2 giây để nhận CA cert
        Serial.println("⏳ Chờ nhận CA cert...");
        unsigned long startWait = millis();
        while (!ca_cert_loaded && (millis() - startWait < 5000)) {
          mqttClient.loop(); // Xử lý MQTT messages
          delay(100);
        }
        
        // Verify lại sau khi nhận CA cert
        if (ca_cert_loaded) {
          Serial.println("\n🔍 Đang verify certificate với CA cert vừa nhận...");
          if (verifyDeviceCertificate(device_certificate)) {
            Serial.println("✅ Certificate đã được verify thành công!");
            Serial.println("\n✅ ĐĂNG KÝ THIẾT BỊ HOÀN TẤT!");
            Serial.println("Device đã sẵn sàng!");
          } else {
            Serial.println("✗ Certificate verification thất bại!");
            Serial.println("⚠️ Certificate đã lưu nhưng chưa được verify");
          }
        } else {
          Serial.println("⚠️ Không nhận được CA cert từ server");
          Serial.println("⚠️ Certificate đã lưu nhưng chưa được verify");
          Serial.println("💡 Bạn có thể verify sau bằng cách reset device");
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






