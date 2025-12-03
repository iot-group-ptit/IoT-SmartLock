package com.example.authenx.presentation.ui.mainapp.statistic

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.authenx.R
import com.example.authenx.databinding.FragmentStatisticBinding
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.BarData
import com.github.mikephil.charting.data.BarDataSet
import com.github.mikephil.charting.data.BarEntry
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class StatisticFragment : Fragment() {

    private var _binding: FragmentStatisticBinding? = null
    private val binding get() = _binding!!
    private val viewModel: StatisticViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStatisticBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setOnClickListener()
        observeUiState()
        setupAccessLog()
    }

    private fun observeUiState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    binding.progressBar.isVisible = state.isLoading
                    
                    state.statistics?.let { stats ->
                        updateStatCards(state)
                        stats.dailyAccess?.takeLast(7)?.let { dailyData ->
                            if (dailyData.isNotEmpty()) {
                                updateChart(dailyData)
                            }
                        }
                        // Update recent access logs
                        updateAccessLog(stats.recentAccess)
                    }
                }
            }
        }
    }

    private fun updateStatCards(state: StatisticUiState) {
        with(binding) {
            tvTotalAccessToday.text = state.todayCount.toString()
            tvTotalAccessWeek.text = state.weekCount.toString()
            tvTotalAccessMonth.text = state.monthCount.toString()
            tvAveragePerDay.text = String.format("%.1f", state.averagePerDay)
        }
    }

    private fun updateChart(dailyData: List<com.example.authenx.domain.model.DailyAccess>) {
        if (dailyData.isEmpty()) {
            setupMockData()
            return
        }

        val entries = dailyData.mapIndexed { index, daily ->
            BarEntry((index + 1).toFloat(), daily.count.toFloat())
        }

        val dataSet = BarDataSet(entries, "Access count (7 days)").apply {
            color = Color.parseColor("#4CAF50")
            valueTextColor = Color.BLACK
            valueTextSize = 12f
        }

        val barData = BarData(dataSet)

        with(binding.chartAccess) {
            data = barData
            description.isEnabled = false
            legend.isEnabled = false

            setFitBars(true)
            animateY(800)

            xAxis.apply {
                position = XAxis.XAxisPosition.BOTTOM
                setDrawGridLines(false)
                granularity = 1f
                // Parse and format dates properly
                val labels = dailyData.map { 
                    try {
                        val parts = it.date.split("-")
                        if (parts.size == 3) {
                            "${parts[2]}/${parts[1]}" // DD/MM format
                        } else {
                            it.date.substring(5) // Fallback to MM-DD
                        }
                    } catch (e: Exception) {
                        it.date
                    }
                }
                valueFormatter = IndexAxisValueFormatter(labels)
            }

            axisLeft.axisMinimum = 0f
            axisRight.isEnabled = false
            invalidate()
        }
    }

    private fun setupMockData() {
        val entries = listOf(
            BarEntry(1f, 12f),
            BarEntry(2f, 18f),
            BarEntry(3f, 9f),
            BarEntry(4f, 25f),
            BarEntry(5f, 15f),
            BarEntry(6f, 22f),
            BarEntry(7f, 19f)
        )

        val dataSet = BarDataSet(entries, "Access count (7 days)").apply {
            color = Color.parseColor("#4CAF50") // xanh lá pastel
            valueTextColor = Color.BLACK
            valueTextSize = 12f
        }

        val barData = BarData(dataSet)

        with (binding) {
            chartAccess.apply {
                data = barData
                description.isEnabled = false
                legend.isEnabled = false

                setFitBars(true)
                animateY(800)

                xAxis.apply {
                    position = XAxis.XAxisPosition.BOTTOM
                    setDrawGridLines(false)
                    granularity = 1f
                    valueFormatter = IndexAxisValueFormatter(
                        listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
                    )
                }

                axisLeft.axisMinimum = 0f
                axisRight.isEnabled = false
                invalidate() // refresh chart
            }

            tvTotalAccessToday.text = "18"
            tvTotalAccessWeek.text = "120"
            tvTotalAccessMonth.text = "420"
            tvAveragePerDay.text = "17.5"
        }
    }

    private fun setOnClickListener () {
        with(binding) {
            btnBack.setOnClickListener {
                findNavController().popBackStack()
            }
            
            btnRefresh.setOnClickListener {
                viewModel.refresh()
            }
        }
    }

    private fun setupAccessLog() {
        // Initialize RecyclerView with adapter
        val adapter = AccessLogAdapter()
        binding.rvAccessLog.adapter = adapter
        binding.rvAccessLog.layoutManager = LinearLayoutManager(requireContext())
    }

    private fun updateAccessLog(recentAccess: List<com.example.authenx.domain.model.RecentAccess>?) {
        val adapter = binding.rvAccessLog.adapter as? AccessLogAdapter
        // Take only the latest 10 access logs
        adapter?.submitList(recentAccess?.take(10) ?: emptyList())
    }


    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
