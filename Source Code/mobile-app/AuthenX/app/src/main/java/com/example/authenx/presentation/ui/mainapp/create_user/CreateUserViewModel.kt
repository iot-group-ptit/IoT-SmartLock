package com.example.authenx.presentation.ui.mainapp.create_user

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.authenx.domain.usecase.CreateUserUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CreateUserViewModel @Inject constructor(
    private val createUserUseCase: CreateUserUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(CreateUserUiState())
    val uiState: StateFlow<CreateUserUiState> = _uiState.asStateFlow()

    fun createUser(fullName: String, phone: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            createUserUseCase(fullName, phone)
                .onSuccess { response ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        success = true,
                        createdUserId = response.user?.id,
                        createdUserName = response.user?.fullName
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Create user failed"
                    )
                }
        }
    }

    fun resetState() {
        _uiState.value = CreateUserUiState()
    }
}

data class CreateUserUiState(
    val isLoading: Boolean = false,
    val success: Boolean = false,
    val error: String? = null,
    val createdUserId: String? = null,
    val createdUserName: String? = null
)
