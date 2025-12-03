package com.example.authenx.presentation.ui.mainapp.user_management

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.authenx.domain.model.User
import com.example.authenx.domain.usecase.DeleteUserUseCase
import com.example.authenx.domain.usecase.GetAllUsersUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UserManagementUiState(
    val users: List<User> = emptyList(),
    val filteredUsers: List<User> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val searchQuery: String = "",
    val filterType: FilterType = FilterType.ALL
)

enum class FilterType {
    ALL, FINGERPRINT, FACE, RFID
}

@HiltViewModel
class UserManagementViewModel @Inject constructor(
    private val getAllUsersUseCase: GetAllUsersUseCase,
    private val deleteUserUseCase: DeleteUserUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(UserManagementUiState(isLoading = true))
    val uiState: StateFlow<UserManagementUiState> = _uiState.asStateFlow()

    init {
        observeUsers()
    }

    private fun observeUsers() {
        viewModelScope.launch {
            getAllUsersUseCase()
                .catch { exception ->
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            error = exception.message ?: "Unknown error"
                        ) 
                    }
                }
                .collect { users ->
                    _uiState.update { currentState ->
                        currentState.copy(
                            users = users,
                            filteredUsers = filterUsers(
                                users,
                                currentState.searchQuery,
                                currentState.filterType
                            ),
                            isLoading = false,
                            error = null
                        )
                    }
                }
        }
    }

    fun searchUsers(query: String) {
        _uiState.update { currentState ->
            currentState.copy(
                searchQuery = query,
                filteredUsers = filterUsers(
                    currentState.users,
                    query,
                    currentState.filterType
                )
            )
        }
    }

    fun setFilter(filterType: FilterType) {
        _uiState.update { currentState ->
            currentState.copy(
                filterType = filterType,
                filteredUsers = filterUsers(
                    currentState.users,
                    currentState.searchQuery,
                    filterType
                )
            )
        }
    }

    fun deleteUser(userId: String) {
        viewModelScope.launch {
            try {
                val success = deleteUserUseCase(userId)
                if (!success) {
                    _uiState.update { it.copy(error = "Failed to delete user") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Delete failed") }
            }
        }
    }

    private fun filterUsers(
        users: List<User>,
        query: String,
        filterType: FilterType
    ): List<User> {
        var filtered = users

        // Apply search filter
        if (query.isNotEmpty()) {
            filtered = filtered.filter { user ->
                user.fullName.contains(query, ignoreCase = true) ||
                user.email.contains(query, ignoreCase = true) ||
                user.phone.contains(query, ignoreCase = true)
            }
        }

        // Apply type filter
        filtered = when (filterType) {
            FilterType.ALL -> filtered
            FilterType.FINGERPRINT -> filtered // TODO: Add fingerprint check
            FilterType.FACE -> filtered // TODO: Add face check
            FilterType.RFID -> filtered // TODO: Add RFID check
        }

        return filtered
    }
}
