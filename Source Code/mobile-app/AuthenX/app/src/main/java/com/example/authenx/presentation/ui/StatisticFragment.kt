package com.example.authenx.presentation.ui

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.example.authenx.databinding.FragmentStatisticBinding
import com.github.mikephil.charting.charts.BarChart
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.data.BarData
import com.github.mikephil.charting.data.BarDataSet
import com.github.mikephil.charting.data.BarEntry

class StatisticFragment : Fragment() {

    private var _binding: FragmentStatisticBinding? = null
    private val binding get() = _binding!!

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
        setupMockData()
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
                    valueFormatter = com.github.mikephil.charting.formatter.IndexAxisValueFormatter(
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
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
