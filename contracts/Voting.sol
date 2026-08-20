// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Voting
 * @notice Voting on three topics defined at construction time.
 *
 * Rules:
 *  - The three topics are supplied to the constructor and can never change.
 *  - Every address may vote exactly once.
 *  - The admin may block addresses; a blocked address cannot vote.
 *  - Anyone can read the tally at any time.
 */
contract Voting {

    /* --------------------------------------------------------------- */
    /* Events                                                          */
    /* --------------------------------------------------------------- */

    event VoteCast(address indexed voter, uint256 indexed topicIndex);
    event AccountBlockedSet(address indexed account, bool blocked);

    /* --------------------------------------------------------------- */
    /* Storage                                                         */
    /* --------------------------------------------------------------- */

    /// Creator of the contract — the only account that can block voters.
    address public admin;

    /// The three voting topics, fixed at construction.
    string[3] private _topics;

    /// Vote count per topic (index 0, 1, 2).
    uint256[3] private _tally;

    /// Tracks whether an address has already voted.
    mapping(address => bool) public hasVoted;

    /// Tracks whether an address is blocked from voting.
    mapping(address => bool) public blocked;

    /* --------------------------------------------------------------- */
    /* Constructor                                                     */
    /* --------------------------------------------------------------- */

    constructor(
        string memory topicA,
        string memory topicB,
        string memory topicC
    ) {
        require(bytes(topicA).length > 0, "Topic A cannot be empty");
        require(bytes(topicB).length > 0, "Topic B cannot be empty");
        require(bytes(topicC).length > 0, "Topic C cannot be empty");

        // The deployer becomes the admin.
        admin = msg.sender;

        _topics[0] = topicA;
        _topics[1] = topicB;
        _topics[2] = topicC;
    }

    /* --------------------------------------------------------------- */
    /* Voting                                                          */
    /* --------------------------------------------------------------- */

    /**
     * @notice Cast a single vote for a topic.
     * @param topicIndex 0, 1 or 2.
     */
    function vote(uint256 topicIndex) public {
        require(topicIndex < 3, "Invalid topic index");
        require(!blocked[msg.sender], "Account is blocked");
        require(!hasVoted[msg.sender], "Already voted");

        hasVoted[msg.sender] = true;
        _tally[topicIndex] += 1;

        emit VoteCast(msg.sender, topicIndex);
    }

    /* --------------------------------------------------------------- */
    /* Blocklist administration (admin only)                           */
    /* --------------------------------------------------------------- */

    /**
     * @notice Block or unblock an account from voting.
     * @dev Only the admin can call this function.
     */
    function setBlocked(address account, bool isBlocked) public {
        require(msg.sender == admin, "Only admin can block");
        require(account != address(0), "Zero address not allowed");

        blocked[account] = isBlocked;

        emit AccountBlockedSet(account, isBlocked);
    }

    /* --------------------------------------------------------------- */
    /* Reading results                                                 */
    /* --------------------------------------------------------------- */

    /// @notice The label of a single topic (0, 1 or 2).
    function getTopic(uint256 topicIndex) public view returns (string memory) {
        require(topicIndex < 3, "Invalid topic index");
        return _topics[topicIndex];
    }

    /// @notice The vote count for a single topic (0, 1 or 2).
    function getVotes(uint256 topicIndex) public view returns (uint256) {
        require(topicIndex < 3, "Invalid topic index");
        return _tally[topicIndex];
    }

    /// @notice Returns the name of the topic with the most votes.
    function winner() public view returns (string memory result) {
        result = "";
        uint256 maxCount = 0;
        for (uint256 i = 0; i < 3; i++) {
            if (_tally[i] > maxCount) {
                maxCount = _tally[i];
                result = _topics[i];
            }
        }
    }
}
