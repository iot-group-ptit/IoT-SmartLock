const User = require("../models/user.model");
const Organization = require("../models/organization.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "MY_SUPER_SECRET_KEY";
const JWT_EXPIRES = "7d"; // token sống 7 ngày

// [POST] http://localhost:3000/user/register - Admin đăng ký tài khoản user_manager
module.exports.register = async (req, res) => {
  try {
    const organization = await Organization.findById(req.body.org_id);
    if (!organization) {
      return res.json({ code: 400, message: "Organization không tồn tại!" });
    }

    if (req.body.password !== req.body.confirmPassword) {
      res.json({
        code: 400,
        message: "Mật khẩu và xác nhận mật khẩu không khớp!",
      });
      return;
    }

    const existEmail = await User.findOne({
      email: req.body.email,
    });

    const existPhone = await User.findOne({
      phone: req.body.phone,
    });

    if (existEmail) {
      res.json({
        code: 400,
        message: "Email đã tồn tại!",
      });
      return;
    } else if (existPhone) {
      res.json({
        code: 400,
        message: "Số điện thoại đã tồn tại!",
      });
      return;
    } else {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      const user = new User({
        fullName: req.body.fullName,
        email: req.body.email,
        password: hashedPassword,
        phone: req.body.phone,
        org_id: req.body.org_id,
        role: "user_manager",
      });

      await user.save();

      res.json({
        code: 200,
        message: "Tạo tài khoản thành công!",
      });
    }
  } catch (error) {
    res.json({
      code: 400,
      message: "Đã xảy ra lỗi khi đăng ký!",
      error: error.message,
    });
  }
};

// [POST] http://localhost:3000/user/login - Admin/user_manager đăng nhập
module.exports.login = async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    const user = await User.findOne({
      email: email,
    });

    if (!user) {
      return res.json({
        code: 400,
        message: "Email không tồn tại!",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({
        code: 400,
        message: "Sai mật khẩu!",
      });
    }

    // Tạo token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        org_id: user.org_id,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return res.json({
      code: 200,
      message: "Đăng nhập thành công!",
      token: token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        org_id: user.org_id,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      code: 500,
      message: "Đã xảy ra lỗi khi đăng nhập!",
      error: error.message,
    });
  }
};

// [POST] http://localhost:3000/user/logout - Admin/user_manager đăng xuất
module.exports.logout = (req, res) => {
  res.json({
    code: 200,
    message: "Đăng xuất thành công! Chỉ cần xoá token phía client.",
  });
};

// [PATCH] http://localhost:3000/user/update - user_manager / admin chỉnh sửa hồ sơ cá nhân
module.exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    //  Không cho sửa các field nhạy cảm
    const blockedFields = [
      "role",
      "parent_id",
      "org_id",
      "_id",
      "createdAt",
      "updatedAt",
    ];
    blockedFields.forEach((f) => delete updates[f]);

    const user = await User.findById(userId);

    if (!user) {
      return res.json({
        code: 404,
        message: "User không tồn tại!",
      });
    }

    // -------------------------
    // 🔐 CHECK ĐỔI MẬT KHẨU
    // -------------------------
    if (updates.oldPassword || updates.newPassword || updates.confirmPassword) {
      // Phải nhập đủ 3 trường
      if (
        !updates.oldPassword ||
        !updates.newPassword ||
        !updates.confirmPassword
      ) {
        return res.json({
          code: 400,
          message:
            "Vui lòng nhập đầy đủ oldPassword, newPassword và confirmPassword!",
        });
      }

      // 1. Check mật khẩu cũ đúng không
      const isMatch = await bcrypt.compare(updates.oldPassword, user.password);
      if (!isMatch) {
        return res.json({
          code: 400,
          message: "Mật khẩu cũ không đúng!",
        });
      }

      // 2. Mật khẩu mới phải khớp confirmPassword
      if (updates.newPassword !== updates.confirmPassword) {
        return res.json({
          code: 400,
          message: "Mật khẩu mới và xác nhận mật khẩu không khớp!",
        });
      }

      // 3. Kiểm tra độ dài
      if (updates.newPassword.length < 6) {
        return res.json({
          code: 400,
          message: "Mật khẩu mới phải có ít nhất 6 ký tự!",
        });
      }

      // 4. Hash password mới
      updates.password = await bcrypt.hash(updates.newPassword, 10);

      // Xóa các field không cần lưu
      delete updates.oldPassword;
      delete updates.newPassword;
      delete updates.confirmPassword;
    }

    // -------------------------
    // 📞 CHECK ĐỔI SĐT
    // -------------------------
    if (updates.phone) {
      const existPhone = await User.findOne({
        phone: updates.phone,
        _id: { $ne: userId },
      });
      if (existPhone) {
        return res.json({
          code: 400,
          message: "Số điện thoại đã tồn tại!",
        });
      }
    }

    // -------------------------
    // 📧 CHECK ĐỔI EMAIL
    // -------------------------
    if (updates.email) {
      const existEmail = await User.findOne({
        email: updates.email,
        _id: { $ne: userId },
      });
      if (existEmail) {
        return res.json({
          code: 400,
          message: "Email đã tồn tại!",
        });
      }
    }

    // -------------------------
    // 🚀 TIẾN HÀNH UPDATE
    // -------------------------
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    return res.json({
      code: 200,
      message: "Cập nhật thông tin thành công!",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      code: 500,
      message: "Lỗi khi cập nhật thông tin!",
      error: error.message,
    });
  }
};

// [GET] http://localhost:3000/user/info - Admin/user_manager lấy ra thông tin cá nhân
module.exports.info = async (req, res) => {
  const user = req.user; // Lấy từ middleware verifyToken
  res.json({
    code: 200,
    message: "Lấy thông tin user thành công",
    user,
  });
};

// [POST] http://localhost:3000/user/create - user_manager tạo tài khoản user
module.exports.createUser = async (req, res) => {
  try {
    // Kiểm tra quyền
    const creator = req.user;
    if (creator.role !== "user_manager" && creator.role !== "admin") {
      return res.status(403).json({
        code: 403,
        message: "Bạn không có quyền tạo user!",
      });
    }

    const { fullName, phone } = req.body;

    // Validate phone không trùng
    const existPhone = await User.findOne({ phone });
    if (existPhone) {
      return res.json({ code: 400, message: "Số điện thoại đã tồn tại!" });
    }

    // Tạo user KHÔNG có password
    const newUser = new User({
      fullName,
      phone,
      role: "user",
      parent_id: creator.id,
    });

    await newUser.save();

    return res.json({
      code: 200,
      message: "Tạo user thành công!",
      user: newUser,
    });
  } catch (error) {
    return res.status(500).json({
      code: 500,
      message: "Lỗi tạo user!",
      error: error.message,
    });
  }
};

// [GET] http://localhost:3000/user/children - Lấy tất cả user nằm dưới quyền của user_manager (hoặc admin)
module.exports.getChildrenUsers = async (req, res) => {
  try {
    const currentUser = req.user; // token decode
    let users = [];

    if (currentUser.role === "admin") {
      // Admin lấy tất cả user_managers
      users = await User.find({
        role: "user_manager",
      }).select("-password");
    } else if (currentUser.role === "user_manager") {
      // user_manager lấy users con của mình
      users = await User.find({
        parent_id: currentUser.id,
        role: "user",
      }).select("-password -email");
    } else {
      return res.status(403).json({
        code: 403,
        message: "Bạn không có quyền truy cập!",
      });
    }
    return res.json({
      code: 200,
      message: "Lấy danh sách user thành công!",
      count: users.length,
      users: users,
    });
  } catch (error) {
    return res.status(500).json({
      code: 500,
      message: "Lỗi khi lấy danh sách user!",
      error: error.message,
    });
  }
};

// [DELETE] http://localhost:3000/user/delete/:id - user_manager xoá 1 user
module.exports.deleteUser = async (req, res) => {
  try {
    const manager = req.user; // thông tin người xoá
    const userId = req.params.id; // id user cần xoá

    // 1. Kiểm tra user cần xoá có tồn tại không
    const user = await User.findById(userId);
    if (!user) {
      return res.json({
        code: 404,
        message: "User không tồn tại!",
      });
    }

    // 2. Nếu là user_manager thì chỉ được xoá user con
    if (manager.role === "user_manager") {
      if (String(user.parent_id) !== String(manager.id)) {
        return res.status(403).json({
          code: 403,
          message: "Bạn không có quyền xoá user này!",
        });
      }
    }

    // 3. admin thì xoá được tất cả, không cần check

    // 4. Tiến hành xoá
    await User.findByIdAndDelete(userId);

    return res.json({
      code: 200,
      message: "Xoá user thành công!",
      deletedUserId: userId,
    });
  } catch (error) {
    return res.status(500).json({
      code: 500,
      message: "Lỗi khi xoá user!",
      error: error.message,
    });
  }
};
