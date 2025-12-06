package com.example.authenx.domain.usecase

import com.example.authenx.domain.model.RegisterDeviceRequest
import com.example.authenx.domain.model.RegisterDeviceResponse
import com.example.authenx.domain.repository.DeviceRepository
import javax.inject.Inject

class RegisterDeviceUseCase @Inject constructor(
    private val deviceRepository: DeviceRepository
) {
    suspend operator fun invoke(deviceId: String): Result<RegisterDeviceResponse> {
        return try {
            if (deviceId.isBlank()) {
                return Result.failure(Exception("Device ID cannot be empty"))
            }

            val request = RegisterDeviceRequest(
                deviceId = deviceId,
                type = "smart_lock",
                model = "ESP32_v1"
            )

            val response = deviceRepository.registerDevice(request)
            if (response.success) {
                Result.success(response)
            } else {
                Result.failure(Exception(response.message))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
