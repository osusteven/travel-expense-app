package com.travelsplit.app.data

import androidx.room.TypeConverter
import com.travelsplit.core.EntryKind
import com.travelsplit.core.Participant
import com.travelsplit.core.SplitMode
import java.math.BigDecimal

/** Money is stored as exact decimal strings so no precision is ever lost. */
class Converters {
    @TypeConverter fun fromBigDecimal(v: BigDecimal): String = v.toPlainString()
    @TypeConverter fun toBigDecimal(v: String): BigDecimal = BigDecimal(v)

    @TypeConverter fun fromParticipant(v: Participant): String = v.name
    @TypeConverter fun toParticipant(v: String): Participant = Participant.valueOf(v)

    @TypeConverter fun fromSplitMode(v: SplitMode): String = v.name
    @TypeConverter fun toSplitMode(v: String): SplitMode = SplitMode.valueOf(v)

    @TypeConverter fun fromKind(v: EntryKind): String = v.name
    @TypeConverter fun toKind(v: String): EntryKind = EntryKind.valueOf(v)
}
