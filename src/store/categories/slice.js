import { createSlice } from '@reduxjs/toolkit'
import { apiGetCategories, apiGetSourceByApplication, apiGetTopCategories } from './actions';

const initialState = {
    categories: {
        isLoading: false,
        data: [],
        level1: [],
        level2: [],
        level3: [],
    },
    topCategories: {
        isLoading: false,
        data: [],
    },
    sourceByApplication: {
        isLoading: false,
        data: [],
    },
}

export const slice = createSlice({
    name: 'categories',
    initialState,
    reducers: {
        clarLevel3: (state, action) => {
            state.categories.level3 = [];
        }
    },
    extraReducers: (builder) => {

        // // Get categories
        // builder.addCase(apiGetCategories.fulfilled, (state, action) => {
        //     state.categories.isLoading = false;
        //     state.categories.data = processCategoryPayload(action.payload);
        // }).addCase(apiGetCategories.pending, (state, action) => {
        //     state.categories.isLoading = true;
        // }).addCase(apiGetCategories.rejected, (state, action) => {
        //     state.categories.isLoading = false;
        // });

        // Get categories
        builder.addCase(apiGetCategories.fulfilled, (state, action) => {
            state.categories.isLoading = false;
            const [key, value] = action.payload;
            state.categories["level" + key] = value;
        }).addCase(apiGetCategories.pending, (state, action) => {
            state.categories.isLoading = true;
        }).addCase(apiGetCategories.rejected, (state, action) => {
            state.categories.isLoading = false;
        });


        // Get top categories
        builder.addCase(apiGetTopCategories.fulfilled, (state, action) => {
            state.topCategories.isLoading = false;
            state.topCategories.data = action.payload;
        }).addCase(apiGetTopCategories.pending, (state, action) => {
            state.topCategories.isLoading = true;
        }).addCase(apiGetTopCategories.rejected, (state, action) => {
            state.topCategories.isLoading = false;
        });


        // Get source by application
        builder.addCase(apiGetSourceByApplication.fulfilled, (state, action) => {
            state.sourceByApplication.isLoading = false;
            state.sourceByApplication.data = action.payload;
        }).addCase(apiGetSourceByApplication.pending, (state, action) => {
            state.sourceByApplication.isLoading = true;
        }).addCase(apiGetSourceByApplication.rejected, (state, action) => {
            state.sourceByApplication.isLoading = false;
        });
    },
})

export const { clarLevel3 } = slice.actions;

export default slice.reducer