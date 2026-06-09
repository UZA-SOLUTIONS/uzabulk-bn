import ReactPaginate from 'react-paginate';

export default function Pagination({ totalPages, handlePageClick, initialPage = 0 }) {
    return (
        <>
            <ReactPaginate
                breakLabel="..."
                nextLabel={'>'}
                onPageChange={handlePageClick}
                pageCount={totalPages}
                previousLabel="<"
                renderOnZeroPageCount={null}
                className='pagination-wrapper'
                initialPage={initialPage}
                // pageRangeDisplayed={2}
                // marginPagesDisplayed={2}
            />
        </>
    );
}