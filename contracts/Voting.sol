// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Voting
 * @notice Voting on three topics that are fixed at construction time.
 *
 * Roles:
 *  - owner: whoever deployed the contract. Immutable. May appoint the admin.
 *  - admin: the only role allowed to change the blocklist. Set in the
 *           constructor, replaceable by the owner.
 *
 * Separating the two is deliberate. The account that owns the ballot is not
 * the account that polices it, so the power to exclude a voter sits in exactly
 * one place and can be handed over without redeploying.
 *
 * Rules:
 *  - The three topics are supplied to the constructor and can never change.
 *  - Every address may vote exactly once.
 *  - The admin may block addresses; a blocked address cannot vote.
 *  - The blocklist can be enumerated, so it is auditable by anyone.
 *  - Anyone can read the tally at any time.
 *
 * Note on privacy: every vote is public. The ledger records who sent each
 * transaction, so this is deliberately NOT a secret ballot. Making it secret
 * needs commit-reveal or off-chain cryptography, which is out of scope here.
 */
contract Voting {
    /* --------------------------------------------------------------- */
    /* Errors                                                          */
    /* --------------------------------------------------------------- */

    error NotOwner();
    error NotAdmin();
    error AlreadyVoted();
    error AccountBlocked();
    error InvalidTopic(uint256 index);
    error InvalidIndex(uint256 index);
    error EmptyTopic();
    error ZeroAddress();
    error OwnerCannotBeBlocked();
    error AdminCannotBeBlocked();

    /* --------------------------------------------------------------- */
    /* Events                                                          */
    /* --------------------------------------------------------------- */

    event VoteCast(address indexed voter, uint256 indexed topicIndex);
    event AccountBlockedSet(address indexed account, bool blocked);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    /* --------------------------------------------------------------- */
    /* Storage                                                         */
    /* --------------------------------------------------------------- */

    uint256 public constant TOPIC_COUNT = 3;

    /// Deployer of the contract. Immutable, so it can never be reassigned.
    address public immutable owner;

    /// The only account allowed to change the blocklist.
    address public admin;

    /// The topics, fixed at construction.
    string[TOPIC_COUNT] private _topics;

    /// Vote count per topic index.
    uint256[TOPIC_COUNT] private _tally;

    /// Enforces the "exactly once" rule. Set automatically when someone votes.
    mapping(address => bool) public hasVoted;

    /// O(1) blocked lookup, used by vote().
    mapping(address => bool) public blocked;

    /// The same information in enumerable form, so the list can be displayed.
    address[] private _blockedList;

    /// Position of an account in _blockedList, stored as index+1 (0 = absent).
    mapping(address => uint256) private _blockedSlot;

    /// Total votes cast across all topics.
    uint256 public totalVotes;

    /* --------------------------------------------------------------- */
    /* Constructor                                                     */
    /* --------------------------------------------------------------- */

    constructor(
        string memory topicA,
        string memory topicB,
        string memory topicC,
        address initialAdmin
    ) {
        // Reject empty topics: a ballot option with no label is a deployment
        // mistake, and the contract is immutable so it could not be repaired.
        if (
            bytes(topicA).length == 0 ||
            bytes(topicB).length == 0 ||
            bytes(topicC).length == 0
        ) {
            revert EmptyTopic();
        }
        if (initialAdmin == address(0)) revert ZeroAddress();

        owner = msg.sender;
        admin = initialAdmin;

        _topics[0] = topicA;
        _topics[1] = topicB;
        _topics[2] = topicC;

        emit AdminChanged(address(0), initialAdmin);
    }

    /* --------------------------------------------------------------- */
    /* Modifiers                                                       */
    /* --------------------------------------------------------------- */

    // msg.sender, never tx.origin: tx.origin would let a malicious contract
    // act on the owner's or admin's behalf if they ever called into it.

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    /* --------------------------------------------------------------- */
    /* Voting                                                          */
    /* --------------------------------------------------------------- */

    /**
     * @notice Cast a single vote for a topic.
     * @param topicIndex 0, 1 or 2.
     */
    function vote(uint256 topicIndex) external {
        if (topicIndex >= TOPIC_COUNT) revert InvalidTopic(topicIndex);
        if (blocked[msg.sender]) revert AccountBlocked();
        if (hasVoted[msg.sender]) revert AlreadyVoted();

        // Effects before anything else. There is no external call in this
        // function, so reentrancy is not reachable today, but recording the
        // vote first keeps that true if the contract is ever extended.
        hasVoted[msg.sender] = true;
        unchecked {
            // Bounded by the number of distinct addresses that can ever vote,
            // so overflow is not physically reachable.
            _tally[topicIndex] += 1;
            totalVotes += 1;
        }

        emit VoteCast(msg.sender, topicIndex);
    }

    /* --------------------------------------------------------------- */
    /* Blocklist administration (admin only)                           */
    /* --------------------------------------------------------------- */

    /**
     * @notice Bar an account from voting, or lift the bar.
     * @dev Blocking does not erase a vote that was already cast.
     */
    function setBlocked(address account, bool isBlocked) public onlyAdmin {
        if (account == address(0)) revert ZeroAddress();
        // The deployer should not be censorable by the admin it appointed,
        // and the account policing the list should not appear on it.
        if (account == owner) revert OwnerCannotBeBlocked();
        if (account == admin) revert AdminCannotBeBlocked();

        // Idempotent: repeating a block must not duplicate the list entry.
        if (blocked[account] == isBlocked) return;

        blocked[account] = isBlocked;

        if (isBlocked) {
            _blockedList.push(account);
            _blockedSlot[account] = _blockedList.length; // 1-based
        } else {
            // Swap-and-pop keeps removal O(1); order of the list is not
            // meaningful, only its membership.
            uint256 slot = _blockedSlot[account];
            uint256 lastIndex = _blockedList.length - 1;

            if (slot - 1 != lastIndex) {
                address moved = _blockedList[lastIndex];
                _blockedList[slot - 1] = moved;
                _blockedSlot[moved] = slot;
            }
            _blockedList.pop();
            _blockedSlot[account] = 0;
        }

        emit AccountBlockedSet(account, isBlocked);
    }

    /// @notice Convenience wrapper: block an account.
    function blockVoter(address account) external {
        setBlocked(account, true);
    }

    /// @notice Convenience wrapper: unblock an account.
    function unblockVoter(address account) external {
        setBlocked(account, false);
    }

    /// @notice Hand the blocklist privilege to a different account.
    function setAdmin(address newAdmin) external onlyOwner {
        if (newAdmin == address(0)) revert ZeroAddress();
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    /* --------------------------------------------------------------- */
    /* Reading the blocklist                                           */
    /* --------------------------------------------------------------- */

    /// @notice How many accounts are currently blocked.
    function getBlockedCount() external view returns (uint256) {
        return _blockedList.length;
    }

    /// @notice The blocked account at a position, for iterating the list.
    function getBlockedVoter(uint256 index) external view returns (address) {
        if (index >= _blockedList.length) revert InvalidIndex(index);
        return _blockedList[index];
    }

    /**
     * @notice The whole blocklist in one call.
     * @dev Unbounded return, but only the admin can grow this list, so its
     *      size is controlled. The scripts here read it via getBlockedCount()
     *      and getBlockedVoter() instead, because the Hedera SDK has no
     *      convenient decoder for a dynamic address array.
     */
    function getBlockedVoters() external view returns (address[] memory) {
        return _blockedList;
    }

    /* --------------------------------------------------------------- */
    /* Reading results                                                 */
    /* --------------------------------------------------------------- */

    /**
     * @notice Human-readable tally, e.g. "Pizza: 2 | Pasta: 1 | Sushi: 0".
     * @dev Returns a single string so it decodes with the plain string
     *      decoder in call.js - no array decoding needed.
     */
    function getResults() external view returns (string memory) {
        return
            string.concat(
                _topics[0], ": ", _toString(_tally[0]), " | ",
                _topics[1], ": ", _toString(_tally[1]), " | ",
                _topics[2], ": ", _toString(_tally[2])
            );
    }

    /// @notice The label of a single topic.
    function getTopic(uint256 topicIndex) external view returns (string memory) {
        if (topicIndex >= TOPIC_COUNT) revert InvalidTopic(topicIndex);
        return _topics[topicIndex];
    }

    /// @notice The vote count of a single topic.
    function getVotes(uint256 topicIndex) external view returns (uint256) {
        if (topicIndex >= TOPIC_COUNT) revert InvalidTopic(topicIndex);
        return _tally[topicIndex];
    }

    /// @notice Whether `account` is still able to cast a vote.
    function canVote(address account) external view returns (bool) {
        return !blocked[account] && !hasVoted[account];
    }

    /**
     * @notice The address the contract sees as the caller.
     * @dev Hedera maps an account to an EVM address; this makes that mapping
     *      visible, so "which address do I block?" is never guesswork.
     */
    function whoAmI() external view returns (address) {
        return msg.sender;
    }

    /* --------------------------------------------------------------- */
    /* Internal helpers                                                */
    /* --------------------------------------------------------------- */

    /// @dev uint256 -> decimal string, for getResults().
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";

        uint256 digits;
        for (uint256 temp = value; temp != 0; temp /= 10) {
            digits++;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
