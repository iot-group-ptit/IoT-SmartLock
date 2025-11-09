package com.example.authenx.presentation.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.authenx.databinding.UserItemBinding
import com.example.authenx.domain.model.User
import java.text.SimpleDateFormat
import java.util.*

class UserAdapter : ListAdapter<User, UserAdapter.UserViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UserViewHolder {
        val binding = UserItemBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return UserViewHolder(binding)
    }

    override fun onBindViewHolder(holder: UserViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class UserViewHolder(private val binding: UserItemBinding) :
        RecyclerView.ViewHolder(binding.root) {

        private val dateFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())

        fun bind(user: User) {
            binding.apply {
                tvUserName.text = user.userName
                tvUserId.text = "ID: ${user.id}"
                ivAvatar.setImageResource(user.avatarRes)

                ivFingerprint.visibility = if (user.hasFingerprint) android.view.View.VISIBLE else android.view.View.GONE
                ivFace.visibility = if (user.hasFace) android.view.View.VISIBLE else android.view.View.GONE
                ivRfid.visibility = if (user.hasRfid) android.view.View.VISIBLE else android.view.View.GONE

                tvLastAccess.text = "Access: ${dateFormat.format(user.lastAccess)}"
            }
        }
    }

    private class DiffCallback : DiffUtil.ItemCallback<User>() {
        override fun areItemsTheSame(oldItem: User, newItem: User): Boolean = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: User, newItem: User): Boolean = oldItem == newItem
    }
}
