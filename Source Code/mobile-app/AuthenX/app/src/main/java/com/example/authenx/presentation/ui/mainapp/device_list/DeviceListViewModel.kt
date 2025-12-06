package com.example.authenx.presentation.ui.mainapp.device_list

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.authenx.domain.model.Device
import com.example.authenx.domain.usecase.GetMyDevicesUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DeviceListViewModel @Inject constructor(
    private val getMyDevicesUseCase: GetMyDevicesUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(DeviceListUiState())
    val uiState: StateFlow<DeviceListUiState> = _uiState.asStateFlow()

    init {
        loadDevices()
    }

    fun loadDevices() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            getMyDevicesUseCase()
                .onSuccess { response ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        devices = response.data,
                        error = null
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Failed to load devices"
                    )
                }
        }
    }
}

data class DeviceListUiState(
    val isLoading: Boolean = false,
    val devices: List<Device> = emptyList(),
    val error: String? = null
)
