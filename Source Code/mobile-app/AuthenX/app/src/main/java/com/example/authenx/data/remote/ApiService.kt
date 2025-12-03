package com.example.authenx.data.remote

import com.example.authenx.BuildConfig
import com.example.authenx.domain.model.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.http.*

class ApiService(private val client: HttpClient) {
    
    companion object {
        const val BASE_URL = BuildConfig.API_BASE_URL
    }
    
    suspend fun login(request: LoginRequest): AuthResponse {
        return client.post("$BASE_URL/auth/login") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    
    suspend fun register(request: RegisterRequest): AuthResponse {
        return client.post("$BASE_URL/auth/register") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    
    suspend fun refreshToken(request: RefreshTokenRequest): AuthResponse {
        return client.post("$BASE_URL/auth/refresh-token") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    
    suspend fun getProfile(token: String): ApiResponse<User> {
        return client.get("$BASE_URL/auth/profile") {
            bearerAuth(token)
        }.body()
    }
    
    // ==================== USERS ====================
    
    suspend fun getAllUsers(token: String): UsersResponse {
        return client.get("$BASE_URL/users") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun getUserById(token: String, userId: String): ApiResponse<User> {
        return client.get("$BASE_URL/users/$userId") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun createUser(token: String, user: User): ApiResponse<User> {
        return client.post("$BASE_URL/users") {
            bearerAuth(token)
            contentType(ContentType.Application.Json)
            setBody(user)
        }.body()
    }
    
    // ==================== DEVICES ====================
    
    suspend fun getAllDevices(token: String): DevicesResponse {
        return client.get("$BASE_URL/devices") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun getDeviceById(token: String, deviceId: String): ApiResponse<Device> {
        return client.get("$BASE_URL/devices/$deviceId") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun createDevice(token: String, device: Device): ApiResponse<Device> {
        return client.post("$BASE_URL/devices") {
            bearerAuth(token)
            contentType(ContentType.Application.Json)
            setBody(device)
        }.body()
    }
    
    // ==================== BIOMETRIC ====================

    suspend fun addFingerprint(token: String, request: AddFingerprintRequest): ApiResponse<Fingerprint> {
        return client.post("$BASE_URL/biometric/fingerprint") {
            bearerAuth(token)
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    
    suspend fun getUserFingerprints(token: String, userId: String): FingerprintsResponse {
        return client.get("$BASE_URL/biometric/fingerprint/user/$userId") {
            bearerAuth(token)
        }.body()
    }
    
    // ==================== ACCESS ====================
    
    suspend fun authenticateRFID(request: AuthenticateRFIDRequest): AccessResponse {
        return client.post("$BASE_URL/access/rfid") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    
    suspend fun authenticateFingerprint(request: AuthenticateFingerprintRequest): AccessResponse {
        return client.post("$BASE_URL/access/fingerprint") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    
    suspend fun remoteUnlock(token: String, request: RemoteUnlockRequest): AccessResponse {
        return client.post("$BASE_URL/access/remote-unlock") {
            bearerAuth(token)
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    
    suspend fun getDoorStatus(token: String, deviceId: String): DoorStatusResponse {
        return client.get("$BASE_URL/access/status/$deviceId") {
            bearerAuth(token)
        }.body()
    }
    
    // ==================== SENSORS ====================
    
    suspend fun getAllSensors(token: String): SensorsResponse {
        return client.get("$BASE_URL/sensors") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun getSensorById(token: String, sensorId: String): ApiResponse<Sensor> {
        return client.get("$BASE_URL/sensors/$sensorId") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun getTelemetryData(token: String): TelemetryResponse {
        return client.get("$BASE_URL/sensors/telemetry/data") {
            bearerAuth(token)
        }.body()
    }
    
    // ==================== LOGS ====================
    
    suspend fun getAccessLogs(token: String): ApiResponse<List<AccessLog>> {
        return client.get("$BASE_URL/logs") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun getAccessStatistics(token: String): StatisticsResponse {
        return client.get("$BASE_URL/logs/statistics") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun getUserAccessHistory(token: String, userId: String): ApiResponse<List<AccessLog>> {
        return client.get("$BASE_URL/logs/user/$userId") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun exportAccessLogs(token: String): String {
        return client.get("$BASE_URL/logs/export") {
            bearerAuth(token)
        }.body()
    }
    
    // ==================== COMMANDS ====================
    
    suspend fun getAllCommands(token: String): CommandsResponse {
        return client.get("$BASE_URL/device/commands") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun getCommandById(token: String, commandId: String): ApiResponse<Command> {
        return client.get("$BASE_URL/device/commands/$commandId") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun sendCommand(token: String, request: SendCommandRequest): ApiResponse<Command> {
        return client.post("$BASE_URL/device/commands") {
            bearerAuth(token)
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    
    // ==================== FIRMWARE ====================
    
    suspend fun getFirmwareUpdates(token: String): FirmwareResponse {
        return client.get("$BASE_URL/device/firmware") {
            bearerAuth(token)
        }.body()
    }
    
    suspend fun initiateFirmwareUpdate(token: String, request: InitiateFirmwareRequest): ApiResponse<FirmwareUpdate> {
        return client.post("$BASE_URL/device/firmware") {
            bearerAuth(token)
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
}
