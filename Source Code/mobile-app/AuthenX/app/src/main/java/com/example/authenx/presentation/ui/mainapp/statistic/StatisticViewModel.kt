package com.example.authenx.presentation.ui.mainapp.statistic

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.authenx.domain.model.AccessStatistics
import com.example.authenx.domain.usecase.GetStatisticsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class StatisticUiState(
    val isLoading: Boolean = false,
    val statistics: AccessStatistics? = null,
    val error: String? = null,
    val todayCount: Int = 0,
    val weekCount: Int = 0,
    val monthCount: Int = 0,
    val averagePerDay: Float = 0f
)

@HiltViewModel
class StatisticViewModel @Inject constructor(
    private val getStatisticsUseCase: GetStatisticsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(StatisticUiState())
    val uiState: StateFlow<StatisticUiState> = _uiState.asStateFlow()

    init {
        loadStatistics()
    }

    fun loadStatistics(
        startDate: String? = null,
        endDate: String? = null,
        userId: String? = null
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            try {
                getStatisticsUseCase(startDate, endDate, userId).collect { statistics ->
                    if (statistics != null) {
                        val (today, week, month, avg) = calculateStats(statistics)
                        
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            statistics = statistics,
                            error = null,
                            todayCount = today as Int,
                            weekCount = week as Int,
                            monthCount = month as Int,
                            averagePerDay = avg as Float
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = "Failed to load statistics"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Unknown error occurred"
                )
            }
        }
    }

    private fun calculateStats(statistics: AccessStatistics): List<Any> {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val today = dateFormat.format(Date())
        
        val calendar = Calendar.getInstance()
        calendar.add(Calendar.DAY_OF_YEAR, -7)
        val weekAgo = dateFormat.format(calendar.time)
        
        calendar.time = Date()
        calendar.add(Calendar.DAY_OF_YEAR, -30)
        val monthAgo = dateFormat.format(calendar.time)

        var todayCount = 0
        var weekCount = 0
        var monthCount = 0

        statistics.dailyAccess?.forEach { daily ->
            val count = daily.count
            val date = daily.date
            
            if (date == today) {
                todayCount = count
            }
            
            if (date >= weekAgo) {
                weekCount += count
            }
            
            if (date >= monthAgo) {
                monthCount += count
            }
        }

        val averagePerDay = if (!statistics.dailyAccess.isNullOrEmpty()) {
            monthCount.toFloat() / 30
        } else {
            0f
        }

        return listOf(todayCount, weekCount, monthCount, averagePerDay)
    }

    fun refresh() {
        loadStatistics()
    }
}