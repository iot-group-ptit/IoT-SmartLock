const Organization = require("../models/organization.model");

// [POST] http://localhost:3000/organization/create - Admin tạo 1 organization
module.exports.createOrganization = async (req, res) => {
  try {
    const { name, address } = req.body;

    const newOrg = new Organization({
      name,
      address,
    });

    await newOrg.save();

    res.json({
      code: 200,
      message: "Tạo Organization thành công!",
      organization: newOrg,
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: "Lỗi tạo Organization!",
      error: error.message,
    });
  }
};

// [DELETE] http://localhost:3000/organization/delete/:id - Admin xoá 1 organization
module.exports.deleteOrganization = async (req, res) => {
  try {
    const orgId = req.params.id;

    // Kiểm tra org có tồn tại không
    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({
        code: 404,
        message: "Organization không tồn tại!",
      });
    }

    // Tiến hành xoá
    await Organization.findByIdAndDelete(orgId);

    res.json({
      code: 200,
      message: "Xoá Organization thành công!",
      deletedId: orgId,
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: "Lỗi xoá Organization!",
      error: error.message,
    });
  }
};
