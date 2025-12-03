package com.example.authenx.presentation.ui.mainapp.user_management

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.PopupMenu
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.example.authenx.R
import com.example.authenx.databinding.UserItemBinding
import com.example.authenx.domain.model.User
import java.text.SimpleDateFormat
import java.util.Locale

class UserAdapter(
    private val onUserClick: (User) -> Unit = {},
    private val onEditClick: (User) -> Unit = {},
    private val onDeleteClick: (User) -> Unit = {}
) : ListAdapter<User, UserAdapter.UserViewHolder>(DiffCallback()) {

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
                tvUserName.text = user.fullName
                tvUserId.text = user.email
                
                val roleText = user.role.replaceFirstChar { 
                    if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() 
                }
                // tvUserRole.text = roleText
                
                // tvCreatedAt.text = "Joined: ${dateFormat.format(user.createdAt)}"
                
//                ivAvatar.setImageResource(user.avatarRes)
//
//                ivFingerprint.visibility = if (user.hasFingerprint) View.VISIBLE else View.GONE
//                ivFace.visibility = if (user.hasFace) View.VISIBLE else View.GONE
//                ivRfid.visibility = if (user.hasRfid) View.VISIBLE else View.GONE
//
//                tvLastAccess.text = "Access: ${dateFormat.format(user.lastAccess)}"
                
                root.setOnClickListener { onUserClick(user) }
                
                // Setup popup menu for more button
                btnMore.setOnClickListener { view ->
                    showPopupMenu(view, user)
                }
            }
        }
        
        private fun showPopupMenu(view: View, user: User) {
            val popup = PopupMenu(view.context, view)
            popup.menuInflater.inflate(R.menu.user_item_menu, popup.menu)
            
            popup.setOnMenuItemClickListener { menuItem ->
                when (menuItem.itemId) {
                    R.id.action_edit -> {
                        onEditClick(user)
                        true
                    }
                    R.id.action_delete -> {
                        onDeleteClick(user)
                        true
                    }
                    else -> false
                }
            }
            
            popup.show()
        }
    }

    private class DiffCallback : DiffUtil.ItemCallback<User>() {
        override fun areItemsTheSame(oldItem: User, newItem: User): Boolean = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: User, newItem: User): Boolean = oldItem == newItem
    }
}