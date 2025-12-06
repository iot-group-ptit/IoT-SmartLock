// const multer = require("multer");
// const path = require("path");
// const fs = require("fs").promises;
// const User = require("../models/User");
// const BiometricData = require("../models/BiometricData");
// const AccessLog = require("../models/AccessLog");
// const faceapi = require("@vladmandic/face-api");
// const canvas = require("canvas");
// const tf = require("@tensorflow/tfjs-node");

// // Configure face-api
// const { Canvas, Image, ImageData } = canvas;
// faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// // Storage configuration
// const storage = multer.diskStorage({
//   destination: async (req, file, cb) => {
//     const uploadPath = path.join(__dirname, "..", "uploads", "faces");
//     try {
//       await fs.mkdir(uploadPath, { recursive: true });
//       cb(null, uploadPath);
//     } catch (error) {
//       cb(error);
//     }
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, `face-${uniqueSuffix}${path.extname(file.originalname)}`);
//   },
// });

// const upload = multer({
//   storage,
//   limits: {
//     fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error("Invalid file type. Only JPEG, JPG and PNG are allowed."));
//     }
//   },
// });

// // Load face-api models
// let modelsLoaded = false;
// const loadModels = async () => {
//   if (modelsLoaded) return;

//   const modelPath = path.join(__dirname, "..", "models");
//   try {
//     await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
//     await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
//     await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
//     modelsLoaded = true;
//     console.log("Face recognition models loaded");
//   } catch (error) {
//     console.error("Error loading face recognition models:", error.message);
//   }
// };

// // Initialize models on module load
// loadModels();

// // Register face
// const registerFace = async (req, res, next) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "No image file provided",
//       });
//     }

//     const { user_id, bio_id } = req.body;

//     // Check if user exists
//     const user = await User.findOne({ user_id });

//     if (!user) {
//       // Delete uploaded file
//       await fs.unlink(req.file.path);
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Load image
//     const img = await canvas.loadImage(req.file.path);

//     // Detect face and extract descriptor
//     const detection = await faceapi
//       .detectSingleFace(img)
//       .withFaceLandmarks()
//       .withFaceDescriptor();

//     if (!detection) {
//       // Delete uploaded file
//       await fs.unlink(req.file.path);
//       return res.status(400).json({
//         success: false,
//         message: "No face detected in the image",
//       });
//     }

//     // Save face descriptor to BiometricData
//     const descriptor = Array.from(detection.descriptor);
//     const dataTemplate = JSON.stringify({
//       descriptor,
//       imagePath: req.file.path,
//     });

//     const biometricData = await BiometricData.create({
//       bio_id,
//       biometric_type: "face",
//       data_template: dataTemplate,
//       user_id,
//     });

//     res.status(201).json({
//       success: true,
//       message: "Face registered successfully",
//       data: { bioId: bio_id },
//     });
//   } catch (error) {
//     // Clean up uploaded file on error
//     if (req.file) {
//       await fs.unlink(req.file.path).catch(console.error);
//     }
//     next(error);
//   }
// };

// // Authenticate face
// const authenticateFace = async (req, res, next) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "No image file provided",
//       });
//     }

//     const { device_id } = req.body;
//     const threshold = parseFloat(process.env.FACE_RECOGNITION_THRESHOLD) || 0.6;

//     // Load image
//     const img = await canvas.loadImage(req.file.path);

//     // Detect face
//     const detection = await faceapi
//       .detectSingleFace(img)
//       .withFaceLandmarks()
//       .withFaceDescriptor();

//     // Clean up uploaded file
//     await fs.unlink(req.file.path);

//     if (!detection) {
//       return res.status(400).json({
//         success: false,
//         message: "No face detected in the image",
//       });
//     }

//     // Get all registered faces from BiometricData
//     const faceRecords = await BiometricData.find({ biometric_type: "face" })
//       .populate("user_id", "user_id full_name")
//       .lean();

//     if (faceRecords.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No registered faces found",
//       });
//     }

//     // Compare with registered faces
//     let bestMatch = null;
//     let bestDistance = Infinity;

//     for (const record of faceRecords) {
//       const templateData = JSON.parse(record.data_template.toString());
//       const storedDescriptor = new Float32Array(templateData.descriptor);
//       const distance = faceapi.euclideanDistance(
//         detection.descriptor,
//         storedDescriptor
//       );

//       if (distance < bestDistance) {
//         bestDistance = distance;
//         bestMatch = record;
//       }
//     }

//     let accessResult = "failed";
//     let userId = null;
//     let message = "Face not recognized";

//     if (bestMatch && bestDistance < threshold) {
//       accessResult = "success";
//       userId = bestMatch.user_id.user_id;
//       message = `Access granted for ${bestMatch.user_id.full_name}`;
//     }

//     // Log access attempt
//     await AccessLog.create({
//       user_id: userId,
//       access_method: "face",
//       access_result: accessResult,
//       device_id,
//       additional_info: JSON.stringify({ distance: bestDistance, threshold }),
//     });

//     // Send notification if failed
//     if (accessResult !== "success" && global.io) {
//       global.io.emit("access_alert", {
//         type: "face",
//         result: accessResult,
//         device_id,
//         timestamp: new Date(),
//       });
//     }

//     res.json({
//       success: accessResult === "success",
//       message,
//       data: {
//         accessResult,
//         userId,
//         confidence: (1 - bestDistance / threshold) * 100,
//       },
//     });
//   } catch (error) {
//     // Clean up uploaded file on error
//     if (req.file) {
//       await fs.unlink(req.file.path).catch(console.error);
//     }
//     next(error);
//   }
// };

// // Get user's face data
// const getUserFaceData = async (req, res, next) => {
//   try {
//     const { user_id } = req.params;

//     const faceData = await BiometricData.find({
//       user_id,
//       biometric_type: "face",
//     })
//       .select("bio_id biometric_type registered_at")
//       .lean();

//     res.json({
//       success: true,
//       data: faceData,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // Delete face data
// const deleteFaceData = async (req, res, next) => {
//   try {
//     const { bio_id } = req.params;

//     // Get face data
//     const faceData = await BiometricData.findOne({
//       bio_id,
//       biometric_type: "face",
//     }).lean();

//     if (!faceData) {
//       return res.status(404).json({
//         success: false,
//         message: "Face data not found",
//       });
//     }

//     // Delete image file if exists
//     if (faceData.data_template) {
//       try {
//         const templateData = JSON.parse(faceData.data_template);
//         if (templateData.imagePath) {
//           await fs.unlink(templateData.imagePath).catch(console.error);
//         }
//       } catch (e) {
//         console.error("Error parsing template data:", e);
//       }
//     }

//     // Delete from database
//     await BiometricData.findOneAndDelete({ bio_id });

//     res.json({
//       success: true,
//       message: "Face data deleted successfully",
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// module.exports = {
//   upload,
//   registerFace,
//   authenticateFace,
//   getUserFaceData,
//   deleteFaceData,
// };
