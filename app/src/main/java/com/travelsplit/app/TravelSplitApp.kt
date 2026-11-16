package com.travelsplit.app

import android.app.Application
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.travelsplit.app.data.ExchangeRateService
import com.travelsplit.app.data.FirestoreRepository
import com.travelsplit.app.data.Repository

open class TravelSplitApp : Application() {
    val repository: Repository by lazy { createRepository() }

    /** Overridden in screenshot tests to supply sample data. */
    protected open fun createRepository(): Repository =
        FirestoreRepository(FirebaseFirestore.getInstance(), FirebaseAuth.getInstance(), ExchangeRateService())
}
