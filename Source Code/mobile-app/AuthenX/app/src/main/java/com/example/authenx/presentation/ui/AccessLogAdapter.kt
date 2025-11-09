package com.example.authenx.presentation.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.authenx.databinding.ItemAccessLogBinding
import com.example.authenx.domain.model.AccessLog
import java.text.SimpleDateFormat
import java.util.*

class AccessLogAdapter : ListAdapter<AccessLog, AccessLogAdapter.AccessLogViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): AccessLogViewHolder {
        val binding = ItemAccessLogBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return AccessLogViewHolder(binding)
    }

    override fun onBindViewHolder(holder: AccessLogViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class AccessLogViewHolder(
        private val binding: ItemAccessLogBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        private val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

        fun bind(log: AccessLog) {
            binding.apply {
                tvUserName.text = log.userName
                tvDate.text = dateFormat.format(log.timestamp)
                tvTime.text = timeFormat.format(log.timestamp)
                tvStatus.text = if (log.status) "Successful" else "Failed"

                // Set status color
                val statusColor = if (log.status) {
                    android.R.color.holo_green_dark
                } else {
                    android.R.color.holo_red_dark
                }
                tvStatus.setTextColor(root.context.getColor(statusColor))
            }
        }
    }

    private class DiffCallback : DiffUtil.ItemCallback<AccessLog>() {
        override fun areItemsTheSame(oldItem: AccessLog, newItem: AccessLog): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: AccessLog, newItem: AccessLog): Boolean {
            return oldItem == newItem
        }
    }
}