package io.nova.app.data.local

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "chats")
data class ChatEntity(
    @PrimaryKey val id: String,
    val participantId: String,
    val participantUsername: String,
    val participantDisplayName: String,
    val updatedAt: String,
    val lastMessageCursor: String? = null,
)

@Entity(
    tableName = "messages",
    indices = [Index(value = ["clientMessageId"], unique = true), Index(value = ["serverId"], unique = true)],
)
data class MessageEntity(
    @PrimaryKey val localKey: String,
    val serverId: String?,
    val clientMessageId: String,
    val chatId: String,
    val senderId: String,
    val text: String,
    val createdAt: String,
    val deliveredAt: String?,
    val readAt: String?,
    val status: String,
)

@Entity(tableName = "outbox")
data class OutboxEntity(
    @PrimaryKey val clientMessageId: String,
    val chatId: String,
    val text: String,
    val createdAt: String,
    val state: String = "PENDING",
    val lastError: String? = null,
)

@Dao
interface NovaDao {
    @Query("SELECT * FROM chats ORDER BY updatedAt DESC")
    fun observeChats(): Flow<List<ChatEntity>>

    @Query("SELECT * FROM chats WHERE id = :chatId LIMIT 1")
    suspend fun findChat(chatId: String): ChatEntity?

    @Query("SELECT id FROM chats")
    suspend fun allChatIds(): List<String>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertChats(chats: List<ChatEntity>)

    @Query("UPDATE chats SET lastMessageCursor = :cursor WHERE id = :chatId")
    suspend fun updateCursor(chatId: String, cursor: String?)

    @Query("SELECT * FROM messages WHERE chatId = :chatId ORDER BY createdAt, localKey")
    fun observeMessages(chatId: String): Flow<List<MessageEntity>>

    @Query("SELECT * FROM messages WHERE clientMessageId = :clientMessageId LIMIT 1")
    suspend fun findMessage(clientMessageId: String): MessageEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMessage(message: MessageEntity)

    @Query("UPDATE messages SET serverId = :serverId, createdAt = :createdAt, deliveredAt = :deliveredAt, readAt = :readAt, status = 'SENT' WHERE clientMessageId = :clientMessageId")
    suspend fun confirmMessage(clientMessageId: String, serverId: String, createdAt: String, deliveredAt: String?, readAt: String?)

    @Query("UPDATE messages SET status = 'FAILED' WHERE clientMessageId = :clientMessageId")
    suspend fun failMessage(clientMessageId: String)

    @Query("UPDATE messages SET status = 'PENDING' WHERE clientMessageId = :clientMessageId")
    suspend fun resetMessage(clientMessageId: String)

    @Query("UPDATE messages SET deliveredAt = COALESCE(deliveredAt, :readAt), readAt = :readAt WHERE serverId IN (:serverIds)")
    suspend fun markRead(serverIds: List<String>, readAt: String)

    @Query("SELECT * FROM outbox WHERE state = 'PENDING' ORDER BY createdAt")
    suspend fun pendingOutbox(): List<OutboxEntity>

    @Query("SELECT * FROM outbox WHERE clientMessageId = :id LIMIT 1")
    suspend fun findOutbox(id: String): OutboxEntity?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertMessage(message: MessageEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertOutbox(outbox: OutboxEntity)

    @Query("UPDATE outbox SET state = 'FAILED', lastError = :error WHERE clientMessageId = :id")
    suspend fun failOutbox(id: String, error: String)

    @Query("UPDATE outbox SET state = 'PENDING', lastError = NULL WHERE clientMessageId = :id")
    suspend fun resetOutbox(id: String)

    @Query("DELETE FROM outbox WHERE clientMessageId = :id")
    suspend fun deleteOutbox(id: String)

    @Query("SELECT COUNT(*) FROM outbox WHERE state = 'PENDING'")
    suspend fun pendingCount(): Int

    @Transaction
    suspend fun enqueue(message: MessageEntity, outbox: OutboxEntity) {
        insertMessage(message)
        insertOutbox(outbox)
    }
}

@Database(entities = [ChatEntity::class, MessageEntity::class, OutboxEntity::class], version = 2, exportSchema = false)
abstract class NovaDatabase : RoomDatabase() {
    abstract fun dao(): NovaDao

    companion object {
        fun create(context: Context): NovaDatabase = Room.databaseBuilder(
            context.applicationContext,
            NovaDatabase::class.java,
            "nova-local.db",
        ).addMigrations(object : androidx.room.migration.Migration(1, 2) {
            override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) { db.execSQL("ALTER TABLE messages ADD COLUMN readAt TEXT") }
        }).build()
    }
}
