const forge = require("node-forge");
const fs = require("fs").promises;
const path = require("path");

class CertificateService {
  constructor() {
    this.caPrivateKey = null;
    this.caCertificate = null;
    this.CA_KEY_PATH = path.join(__dirname, "../keys/ca-key.pem");
    this.CA_CERT_PATH = path.join(__dirname, "../keys/ca-cert.pem");
  }

  // ✅ Khởi tạo CA (chạy 1 lần khi setup server)
  async initializeCA() {
    try {
      // Kiểm tra đã có CA chưa
      const caKeyExists = await this.fileExists(this.CA_KEY_PATH);
      const caCertExists = await this.fileExists(this.CA_CERT_PATH);

      if (caKeyExists && caCertExists) {
        console.log("✓ Loading existing CA...");
        await this.loadCA();
        return;
      }

      console.log("⚠️ CA chưa tồn tại, đang tạo mới...");
      await this.createCA();
      console.log("✓ CA đã tạo thành công!");
    } catch (error) {
      console.error("✗ Lỗi khởi tạo CA:", error);
      throw error;
    }
  }

  // ✅ Tạo CA Certificate (Root CA)
  async createCA() {
    console.log("🔐 Đang tạo Root CA...");

    // 1. Tạo RSA keypair cho CA (2048-bit)
    const keys = forge.pki.rsa.generateKeyPair(2048);
    this.caPrivateKey = keys.privateKey;

    // 2. Tạo CA Certificate
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = "01"; // CA thường dùng serial number đơn giản

    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(
      cert.validity.notBefore.getFullYear() + 10
    ); // 10 năm

    // 3. Set Subject (Issuer = Subject vì là self-signed)
    const attrs = [
      { name: "commonName", value: "SmartLock Root CA" },
      { name: "countryName", value: "VN" },
      { name: "organizationName", value: "SmartLock IoT" },
      { shortName: "OU", value: "Security" },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs); // Self-signed

    // 4. Extensions (v3)
    cert.setExtensions([
      {
        name: "basicConstraints",
        cA: true, // ĐÂY LÀ CA
        critical: true,
      },
      {
        name: "keyUsage",
        keyCertSign: true,
        cRLSign: true,
        critical: true,
      },
      {
        name: "subjectKeyIdentifier",
      },
    ]);

    // 5. Self-sign certificate
    cert.sign(this.caPrivateKey, forge.md.sha256.create());

    this.caCertificate = cert;

    // 6. Lưu vào file
    await this.saveCA();

    console.log("✓ Root CA created successfully");
    console.log("   Serial:", cert.serialNumber);
    console.log("   Valid from:", cert.validity.notBefore);
    console.log("   Valid to:", cert.validity.notAfter);
  }

  // ✅ Load CA từ file
  async loadCA() {
    try {
      const keyPem = await fs.readFile(this.CA_KEY_PATH, "utf8");
      const certPem = await fs.readFile(this.CA_CERT_PATH, "utf8");

      this.caPrivateKey = forge.pki.privateKeyFromPem(keyPem);
      this.caCertificate = forge.pki.certificateFromPem(certPem);

      console.log("✓ CA loaded from files");
    } catch (error) {
      throw new Error("Không thể load CA: " + error.message);
    }
  }

  // ✅ Lưu CA vào file
  async saveCA() {
    try {
      // Tạo thư mục keys nếu chưa có
      const keysDir = path.dirname(this.CA_KEY_PATH);
      await fs.mkdir(keysDir, { recursive: true });

      // Lưu private key
      const keyPem = forge.pki.privateKeyToPem(this.caPrivateKey);
      await fs.writeFile(this.CA_KEY_PATH, keyPem);

      // Lưu certificate
      const certPem = forge.pki.certificateToPem(this.caCertificate);
      await fs.writeFile(this.CA_CERT_PATH, certPem);

      console.log("✓ CA saved to:", keysDir);
    } catch (error) {
      throw new Error("Không thể lưu CA: " + error.message);
    }
  }

  // ✅ CẤP CERTIFICATE CHO DEVICE (X.509 v3)
  async issueDeviceCertificate(deviceId, publicKeyPem) {
    if (!this.caPrivateKey || !this.caCertificate) {
      throw new Error("CA chưa được khởi tạo!");
    }

    console.log(`📜 Đang cấp certificate cho ${deviceId}...`);

    try {
      // 1. Parse public key từ PEM
      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);

      // 2. Tạo certificate mới
      const cert = forge.pki.createCertificate();

      cert.publicKey = publicKey;

      // 3. Generate unique serial number
      cert.serialNumber = this.generateSerialNumber();

      // 4. Validity (1 năm)
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(
        cert.validity.notBefore.getFullYear() + 1
      );

      // 5. Subject (thông tin thiết bị)
      cert.setSubject([
        { name: "commonName", value: deviceId },
        { name: "organizationName", value: "SmartLock Devices" },
        { shortName: "OU", value: "IoT Devices" },
      ]);

      // 6. Issuer (thông tin CA)
      cert.setIssuer(this.caCertificate.subject.attributes);

      cert.setExtensions([
        {
          name: "basicConstraints",
          cA: false,
          critical: true,
        },
        {
          name: "keyUsage",
          digitalSignature: true,
          keyEncipherment: true,
          critical: true,
        },
        {
          name: "subjectKeyIdentifier",
        },
        {
          name: "authorityKeyIdentifier",
          keyIdentifier: this.caCertificate
            .generateSubjectKeyIdentifier()
            .getBytes(),
        },
        {
          name: "subjectAltName",
          altNames: [
            { type: 2, value: `${deviceId}.smartlock.local` },
            { type: 7, ip: "0.0.0.0" },
          ],
        },
      ]);

      // 8. Sign certificate bằng CA private key
      cert.sign(this.caPrivateKey, forge.md.sha256.create());

      // 9. Convert sang PEM format
      const certPem = forge.pki.certificateToPem(cert);

      console.log("✓ Certificate issued successfully");
      console.log("   Serial:", cert.serialNumber);
      console.log("   Subject:", deviceId);
      console.log("   Valid until:", cert.validity.notAfter);

      return {
        certificate: certPem,
        serialNumber: cert.serialNumber,
        validFrom: cert.validity.notBefore,
        validTo: cert.validity.notAfter,
      };
    } catch (error) {
      console.error("✗ Lỗi cấp certificate:", error);
      throw new Error("Không thể cấp certificate: " + error.message);
    }
  }

  // ✅ Generate serial number ngẫu nhiên (hex)
  generateSerialNumber() {
    // Tạo 16 bytes random = 32 hex chars
    const bytes = forge.random.getBytesSync(16);
    return forge.util.bytesToHex(bytes);
  }

  // ✅ Verify certificate (dùng CA cert)
  verifyCertificate(certPem) {
    try {
      const cert = forge.pki.certificateFromPem(certPem);

      // Verify signature
      const caStore = forge.pki.createCaStore([this.caCertificate]);

      try {
        forge.pki.verifyCertificateChain(caStore, [cert]);
        console.log("✓ Certificate valid");
        return true;
      } catch (e) {
        console.log("✗ Certificate invalid:", e.message);
        return false;
      }
    } catch (error) {
      console.error("✗ Lỗi verify certificate:", error);
      return false;
    }
  }

  // ✅ Get CA certificate (để gửi cho ESP32)
  getCACertificate() {
    if (!this.caCertificate) {
      throw new Error("CA chưa được khởi tạo");
    }
    return forge.pki.certificateToPem(this.caCertificate);
  }

  // Helper: kiểm tra file tồn tại
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton
const certificateService = new CertificateService();
module.exports = certificateService;
