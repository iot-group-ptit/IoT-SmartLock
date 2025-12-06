package com.example.authenx.data.repository

import com.example.authenx.data.remote.source.DeviceDataSource
import com.example.authenx.domain.model.DevicesResponse
import com.example.authenx.domain.model.RegisterDeviceRequest
import com.example.authenx.domain.model.RegisterDeviceResponse
import com.example.authenx.domain.repository.DeviceRepository
import javax.inject.Inject

class DeviceRepositoryImpl @Inject constructor(
    private val deviceDataSource: DeviceDataSource
) : DeviceRepository {

    override suspend fun getMyDevices(): DevicesResponse {
        return deviceDataSource.getMyDevices()
    }

    override suspend fun registerDevice(request: RegisterDeviceRequest): RegisterDeviceResponse {
        return deviceDataSource.registerDevice(request)
    }
}
